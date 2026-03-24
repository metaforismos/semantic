import { callLLM } from "@/lib/llm";
import { safeParseJSON } from "@/lib/parse";
import { buildAnalysisSystemPrompt, buildAnalysisUserMessage } from "@/lib/concierge/prompts";
import type { Conversation, ConversationAnalysis } from "@/lib/concierge/types";

const BATCH_SIZE = 20;
const MAX_MESSAGES_FOR_SOLO = 50;

function createBatches(conversations: Conversation[]): Conversation[][] {
  const batches: Conversation[][] = [];
  let currentBatch: Conversation[] = [];

  for (const conv of conversations) {
    if (conv.messages.length > MAX_MESSAGES_FOR_SOLO) {
      // Long conversations go solo
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
            maxTokens: 8192,
          });

          const parsed = safeParseJSON<ConversationAnalysis[]>(result.text);

          if (Array.isArray(parsed)) {
            allAnalyses.push(...parsed);
            send({
              type: "batch_complete",
              batch: i + 1,
              count: parsed.length,
            });
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          send({
            type: "batch_error",
            batch: i + 1,
            error: errorMsg,
          });
          // Continue with next batch
        }

        // Small delay between batches to avoid rate limiting
        if (i < batches.length - 1) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      send({
        type: "complete",
        analyses: allAnalyses,
        total_analyzed: allAnalyses.length,
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
