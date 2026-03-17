import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { getModelOption } from "./types";

interface CallLLMParams {
  modelId: string; // One of MODEL_OPTIONS[].id, e.g. "claude-haiku"
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
}

interface CallLLMResult {
  text: string;
  modelUsed: string; // The actual model ID sent to the provider
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isRetryable =
        lastError.message.includes("overloaded") ||
        lastError.message.includes("rate") ||
        lastError.message.includes("529") ||
        lastError.message.includes("500") ||
        lastError.message.includes("timeout") ||
        lastError.message.includes("ECONNRESET") ||
        lastError.message.includes("fetch failed");

      if (!isRetryable || attempt === retries) throw lastError;

      const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500;
      console.log(`[LLM] Retry ${attempt + 1}/${retries} after ${Math.round(delay)}ms — ${lastError.message}`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError!;
}

export async function callLLM({ modelId, systemPrompt, userMessage, maxTokens = 4096 }: CallLLMParams): Promise<CallLLMResult> {
  const option = getModelOption(modelId);
  if (!option) {
    throw new Error(`Unknown model: ${modelId}`);
  }

  if (option.provider === "claude") {
    return withRetry(() => callClaude({ modelId: option.modelId, systemPrompt, userMessage, maxTokens }));
  }

  if (option.provider === "gemini") {
    return withRetry(() => callGemini({ modelId: option.modelId, systemPrompt, userMessage, maxTokens }));
  }

  throw new Error(`Unsupported provider: ${option.provider}`);
}

async function callClaude({ modelId, systemPrompt, userMessage, maxTokens }: { modelId: string; systemPrompt: string; userMessage: string; maxTokens: number }): Promise<CallLLMResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: modelId,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  return { text: content.text, modelUsed: modelId };
}

async function callGemini({ modelId, systemPrompt, userMessage, maxTokens }: { modelId: string; systemPrompt: string; userMessage: string; maxTokens: number }): Promise<CallLLMResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: modelId,
    contents: userMessage,
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: maxTokens,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Empty response from Gemini");
  }

  return { text, modelUsed: modelId };
}
