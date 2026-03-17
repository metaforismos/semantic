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

export async function callLLM({ modelId, systemPrompt, userMessage, maxTokens = 4096 }: CallLLMParams): Promise<CallLLMResult> {
  const option = getModelOption(modelId);
  if (!option) {
    throw new Error(`Unknown model: ${modelId}`);
  }

  if (option.provider === "claude") {
    return callClaude({ modelId: option.modelId, systemPrompt, userMessage, maxTokens });
  }

  if (option.provider === "gemini") {
    return callGemini({ modelId: option.modelId, systemPrompt, userMessage, maxTokens });
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
