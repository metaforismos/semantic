import { callLLM } from "@/lib/llm";
import { safeParseJSON } from "@/lib/parse";
import { buildAnalysisSystemPrompt, buildAnalysisUserMessage } from "@/lib/concierge/prompts";
import type { Conversation, ConversationAnalysis } from "@/lib/concierge/types";
import pool from "@/lib/db";

// Allow up to 5 minutes for large datasets (many batches of LLM calls)
export const maxDuration = 300;

const BATCH_SIZE = 10; // Smaller batches for reliability with long conversations
const MAX_MESSAGES_FOR_SOLO = 30;
const KEEPALIVE_INTERVAL_MS = 15_000; // Send keepalive every 15s to prevent timeouts

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

function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(request: Request) {
  let conversations: Conversation[];
  try {
    const body = await request.json();
    conversations = body.conversations;
  } catch (err) {
    console.error("[Analyze] Failed to parse request body:", err);
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  console.log(`[Analyze] Received ${conversations.length} conversations`);

  // Reconstruct Date objects (serialized as strings over JSON)
  for (const conv of conversations) {
    for (const msg of conv.messages) {
      msg.sent_at = new Date(msg.sent_at) as unknown as Date;
    }
  }

  // Client should already filter active-only, but keep server-side filter as safety net
  const activeConversations = conversations.filter((c) => c.is_active);
  const batches = createBatches(activeConversations);
  const systemPrompt = buildAnalysisSystemPrompt();

  // Create a job ID so the client can recover results if the stream breaks
  const jobId = generateJobId();

  // Save initial job state to DB
  try {
    await pool.query(
      `INSERT INTO analysis_jobs (job_id, status, total_batches, completed_batches, analyses, created_at)
       VALUES ($1, 'running', $2, 0, '[]'::jsonb, NOW())`,
      [jobId, batches.length]
    );
  } catch (err) {
    console.error("[Analyze] Failed to create job record:", err);
    // Non-fatal: continue without persistence
  }

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

      // Send the job ID first so the client can recover
      send({ type: "job_id", job_id: jobId });

      // Keepalive: send SSE comments periodically to prevent proxy/browser timeouts
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

      const allAnalyses: ConversationAnalysis[] = [];
      let failedBatches = 0;

      for (let i = 0; i < batches.length; i++) {
        send({
          type: "progress",
          current_batch: i + 1,
          total_batches: batches.length,
          message: `Analizando lote ${i + 1} de ${batches.length} (${batches[i].length} conversaciones)...`,
        });

        try {
          const userMessage = buildAnalysisUserMessage(batches[i]);
          const result = await callLLM({
            modelId: "gemini-flash",
            systemPrompt,
            userMessage,
            maxTokens: 16384,
          });

          let parsed: ConversationAnalysis[];
          try {
            parsed = safeParseJSON<ConversationAnalysis[]>(result.text);
          } catch (parseErr) {
            // Log the raw response for debugging
            console.error(`[Batch ${i + 1}] JSON parse failed. Raw response (first 500 chars):`, result.text.substring(0, 500));
            send({
              type: "batch_error",
              batch: i + 1,
              error: `Error parseando respuesta del LLM: ${(parseErr as Error).message}`,
            });
            failedBatches++;
            continue;
          }

          if (Array.isArray(parsed) && parsed.length > 0) {
            allAnalyses.push(...parsed);
            send({
              type: "batch_complete",
              batch: i + 1,
              count: parsed.length,
              model_used: result.modelUsed,
              analyses: parsed,
            });
          } else {
            console.error(`[Batch ${i + 1}] LLM returned non-array or empty. Raw:`, result.text.substring(0, 300));
            send({
              type: "batch_error",
              batch: i + 1,
              error: "LLM retornó respuesta vacía o formato inválido.",
            });
            failedBatches++;
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error(`[Batch ${i + 1}] LLM call failed:`, errorMsg);
          send({
            type: "batch_error",
            batch: i + 1,
            error: errorMsg,
          });
          failedBatches++;
        }

        // Save progress to DB after each batch (non-blocking)
        pool.query(
          `UPDATE analysis_jobs SET completed_batches = $1, analyses = $2::jsonb WHERE job_id = $3`,
          [i + 1, JSON.stringify(allAnalyses), jobId]
        ).catch((err) => console.error("[Analyze] Failed to save batch progress:", err));

        // Delay between batches to avoid rate limiting
        if (i < batches.length - 1) {
          await new Promise((r) => setTimeout(r, 800));
        }
      }

      clearInterval(keepalive);

      // Mark job as complete in DB (this persists even if stream is broken)
      try {
        await pool.query(
          `UPDATE analysis_jobs SET status = 'complete', completed_batches = $1, analyses = $2::jsonb, failed_batches = $3 WHERE job_id = $4`,
          [batches.length, JSON.stringify(allAnalyses), failedBatches, jobId]
        );
        console.log(`[Analyze] Job ${jobId} complete: ${allAnalyses.length} analyses, ${failedBatches} failed batches`);
      } catch (err) {
        console.error("[Analyze] Failed to save final job state:", err);
      }

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
      "X-Accel-Buffering": "no", // Disable nginx/reverse-proxy buffering (Railway, etc.)
    },
  });
}
