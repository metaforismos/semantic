import { callLLM } from "@/lib/llm";
import { safeParseJSON } from "@/lib/parse";
import { buildAnalysisSystemPrompt, buildAnalysisUserMessage } from "@/lib/concierge/prompts";
import type { Conversation, ConversationAnalysis } from "@/lib/concierge/types";

const BATCH_SIZE = 10; // Smaller batches for reliability with long conversations
const MAX_MESSAGES_FOR_SOLO = 30;

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
  const { conversations } = (await request.json()) as {
    conversations: Conversation[];
  };

  // Reconstruct Date objects (serialized as strings over JSON)
  for (const conv of conversations) {
    for (const msg of conv.messages) {
      msg.sent_at = new Date(msg.sent_at) as unknown as Date;
    }
  }

  const activeConversations = conversations.filter((c) => c.is_active);
  const batches = createBatches(activeConversations);
  const systemPrompt = buildAnalysisSystemPrompt();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

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

        // Delay between batches to avoid rate limiting
        if (i < batches.length - 1) {
          await new Promise((r) => setTimeout(r, 800));
        }
      }

      send({
        type: "complete",
        analyses: allAnalyses,
        total_analyzed: allAnalyses.length,
        failed_batches: failedBatches,
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
