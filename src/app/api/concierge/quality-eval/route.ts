import { callLLM } from "@/lib/llm";
import { safeParseJSON } from "@/lib/parse";
import {
  buildQualityEvalSystemPrompt,
  buildQualityEvalUserMessage,
  buildProposalSystemPrompt,
  buildProposalUserMessage,
} from "@/lib/concierge/quality-prompts";
import { computeDimensionAverages, computeWeightedScore, aggregateQualityReport } from "@/lib/concierge/quality-aggregator";
import type { Conversation } from "@/lib/concierge/types";
import type {
  PipelinePrompt,
  ConversationQualityAnalysis,
  QualityProposal,
  QualityUploadFormData,
  WorkerAttribution,
} from "@/lib/concierge/quality-types";

export const maxDuration = 300;

const BATCH_SIZE = 5; // Smaller batches: heavier prompt with pipeline prompts included
const MAX_MESSAGES_FOR_SOLO = 25;
const KEEPALIVE_INTERVAL_MS = 15_000;

function createBatches(conversations: Conversation[]): Conversation[][] {
  const batches: Conversation[][] = [];
  let currentBatch: Conversation[] = [];

  for (const conv of conversations) {
    if (conv.messages.length > MAX_MESSAGES_FOR_SOLO) {
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [];
      }
      batches.push([conv]);
    } else {
      currentBatch.push(conv);
      if (currentBatch.length >= BATCH_SIZE) {
        batches.push(currentBatch);
        currentBatch = [];
      }
    }
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

export async function POST(request: Request) {
  let conversations: Conversation[];
  let activePrompts: PipelinePrompt[];
  let formData: QualityUploadFormData;

  try {
    const body = await request.json();
    conversations = body.conversations;
    activePrompts = body.active_prompts;
    formData = body.form_data;
  } catch (err) {
    console.error("[QualityEval] Failed to parse request body:", err);
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  console.log(`[QualityEval] Received ${conversations.length} conversations, ${activePrompts.length} active prompts`);

  // Reconstruct Date objects
  for (const conv of conversations) {
    for (const msg of conv.messages) {
      msg.sent_at = new Date(msg.sent_at) as unknown as Date;
    }
  }

  const activeConversations = conversations.filter((c) => c.is_active);
  const batches = createBatches(activeConversations);
  const evalSystemPrompt = buildQualityEvalSystemPrompt(activePrompts);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let streamClosed = false;

      function send(data: Record<string, unknown>) {
        if (streamClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          streamClosed = true;
        }
      }

      const keepalive = setInterval(() => {
        if (streamClosed) {
          clearInterval(keepalive);
          return;
        }
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          streamClosed = true;
          clearInterval(keepalive);
        }
      }, KEEPALIVE_INTERVAL_MS);

      const allAnalyses: ConversationQualityAnalysis[] = [];
      let failedBatches = 0;

      // Phase 1: Evaluate conversations
      for (let i = 0; i < batches.length; i++) {
        send({
          type: "progress",
          stage: "analyzing",
          current_batch: i + 1,
          total_batches: batches.length,
          message: `Evaluando lote ${i + 1} de ${batches.length} (${batches[i].length} conversaciones)...`,
        });

        try {
          const userMessage = buildQualityEvalUserMessage(batches[i]);
          const result = await callLLM({
            modelId: "claude-sonnet",
            systemPrompt: evalSystemPrompt,
            userMessage,
            maxTokens: 16384,
          });

          let parsed: ConversationQualityAnalysis[];
          try {
            parsed = safeParseJSON<ConversationQualityAnalysis[]>(result.text);
          } catch (parseErr) {
            console.error(`[QualityEval Batch ${i + 1}] JSON parse failed. Raw (500 chars):`, result.text.substring(0, 500));
            send({ type: "batch_error", batch: i + 1, error: `Error parseando respuesta: ${(parseErr as Error).message}` });
            failedBatches++;
            continue;
          }

          if (Array.isArray(parsed) && parsed.length > 0) {
            // Patch deterministic fields from original conversations (don't trust LLM)
            const batchConvMap = new Map(batches[i].map((c) => [c.conversation_id, c]));
            for (const analysis of parsed) {
              const origConv = batchConvMap.get(analysis.conversation_id);
              if (origConv) {
                analysis.customer_id = origConv.customer_id;
              }
              // Compute weighted overall score deterministically
              analysis.overall_quality_score = computeWeightedScore(analysis.dimensions);
            }
            allAnalyses.push(...parsed);
            send({
              type: "batch_complete",
              batch: i + 1,
              count: parsed.length,
              model_used: result.modelUsed,
            });
          } else {
            console.error(`[QualityEval Batch ${i + 1}] Empty or non-array. Raw:`, result.text.substring(0, 300));
            send({ type: "batch_error", batch: i + 1, error: "Respuesta vacía o formato inválido." });
            failedBatches++;
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error(`[QualityEval Batch ${i + 1}] LLM call failed:`, errorMsg);
          send({ type: "batch_error", batch: i + 1, error: errorMsg });
          failedBatches++;
        }

        if (i < batches.length - 1) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      // Phase 2: Generate proposals
      let proposals: QualityProposal[] = [];

      if (allAnalyses.length > 0) {
        send({
          type: "progress",
          stage: "proposing",
          current_batch: 0,
          total_batches: 0,
          message: "Generando propuestas de mejora...",
        });

        try {
          const dimensionAverages = computeDimensionAverages(allAnalyses);

          // Build temporary worker attributions for proposal generation
          const workerMap = new Map<string, WorkerAttribution>();
          const dims = ["hallucination", "false_agency", "avoidable_derivation", "resolution", "tone", "language_match", "continuity"] as const;
          for (const analysis of allAnalyses) {
            for (const dim of dims) {
              for (const issue of analysis.dimensions[dim]?.issues ?? []) {
                const worker = issue.responsible_worker || "UNKNOWN";
                const existing = workerMap.get(worker) || { worker, total_issues: 0, by_dimension: {}, top_issues: [] };
                existing.total_issues++;
                existing.by_dimension[dim] = (existing.by_dimension[dim] || 0) + 1;
                existing.top_issues.push(issue);
                workerMap.set(worker, existing);
              }
            }
          }
          const workerAttributions = [...workerMap.values()].sort((a, b) => b.total_issues - a.total_issues);

          const proposalSystemPrompt = buildProposalSystemPrompt(activePrompts);
          const proposalUserMessage = buildProposalUserMessage(workerAttributions, allAnalyses, dimensionAverages);

          const result = await callLLM({
            modelId: "claude-sonnet",
            systemPrompt: proposalSystemPrompt,
            userMessage: proposalUserMessage,
            maxTokens: 8192,
          });

          console.log(`[QualityEval] Proposal LLM response (${result.text.length} chars, model: ${result.modelUsed})`);

          let parsed: { proposals: QualityProposal[] };
          try {
            parsed = safeParseJSON<{ proposals: QualityProposal[] }>(result.text);
          } catch (parseErr) {
            console.error("[QualityEval] Proposal JSON parse failed. Raw (500 chars):", result.text.substring(0, 500));
            send({ type: "proposals_error", error: `Error parseando propuestas: ${(parseErr as Error).message}` });
            parsed = { proposals: [] };
          }

          if (parsed.proposals && Array.isArray(parsed.proposals)) {
            proposals = parsed.proposals;
            send({ type: "proposals_complete", count: proposals.length });
          } else {
            console.error("[QualityEval] Proposals response missing 'proposals' array. Keys:", Object.keys(parsed));
            send({ type: "proposals_error", error: "Formato de propuestas inválido" });
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error("[QualityEval] Proposal generation failed:", errorMsg);
          send({ type: "proposals_error", error: errorMsg });
        }
      }

      // Phase 3: Aggregate and send final report
      if (allAnalyses.length > 0) {
        send({
          type: "progress",
          stage: "aggregating",
          current_batch: 0,
          total_batches: 0,
          message: "Agregando métricas...",
        });

        try {
          const report = aggregateQualityReport(allAnalyses, proposals, formData);
          send({ type: "report", report });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          send({ type: "report_error", error: errorMsg });
        }
      }

      clearInterval(keepalive);

      send({
        type: "complete",
        total_analyzed: allAnalyses.length,
        failed_batches: failedBatches,
      });

      if (!streamClosed) {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
