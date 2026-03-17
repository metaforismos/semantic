import { NextRequest, NextResponse } from "next/server";
import { buildExtractionSystemPrompt } from "@/lib/prompts";
import { callLLM } from "@/lib/llm";
import { safeParseJSON } from "@/lib/parse";
import { Mention, ReviewAnalysis, Subtopic } from "@/lib/types";
import poolData from "@/data/subtopics_pool.json";

const pool = poolData as Subtopic[];

export async function POST(req: NextRequest) {
  const start = Date.now();

  try {
    const { text, reviewId, model = "claude-haiku", customPrompt } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing review text" }, { status: 400 });
    }

    const systemPrompt = buildExtractionSystemPrompt(pool, customPrompt || undefined);

    const { text: rawText, modelUsed } = await callLLM({
      modelId: model,
      systemPrompt,
      userMessage: text,
      maxTokens: 4096,
    });

    let parsed: { source_language: string; mentions: Mention[] };
    try {
      parsed = safeParseJSON(rawText);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse LLM response", raw: rawText },
        { status: 500 }
      );
    }

    const mentions: Mention[] = parsed.mentions.map((m, i) => ({
      ...m,
      id: `${reviewId || "review"}-mention-${i}`,
    }));

    const positiveCount = mentions.filter((m) => m.polarity === "positive").length;
    const negativeCount = mentions.filter((m) => m.polarity === "negative").length;
    const total = mentions.length || 1;

    const score = (positiveCount - negativeCount) / total;
    let overallPolarity: ReviewAnalysis["overall_sentiment"]["polarity"];
    if (positiveCount > 0 && negativeCount > 0) overallPolarity = "mixed";
    else if (positiveCount > negativeCount) overallPolarity = "positive";
    else if (negativeCount > positiveCount) overallPolarity = "negative";
    else overallPolarity = "neutral";

    const result: ReviewAnalysis = {
      id: reviewId || `review-${Date.now()}`,
      raw_text: text,
      source_language: parsed.source_language,
      mentions,
      overall_sentiment: { polarity: overallPolarity, score: Math.round(score * 100) / 100 },
      processing_time_ms: Date.now() - start,
      model_used: modelUsed,
    };

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
