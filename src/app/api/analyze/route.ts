import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildExtractionSystemPrompt } from "@/lib/prompts";
import { Mention, ReviewAnalysis, Subtopic } from "@/lib/types";
import poolData from "@/data/subtopics_pool.json";

const pool = poolData as Subtopic[];

export async function POST(req: NextRequest) {
  const start = Date.now();

  try {
    const { text, reviewId } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing review text" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const client = new Anthropic({ apiKey });
    const systemPrompt = buildExtractionSystemPrompt(pool);

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: text }],
    });

    const rawContent = response.content[0];
    if (rawContent.type !== "text") {
      return NextResponse.json({ error: "Unexpected response type" }, { status: 500 });
    }

    let parsed: { source_language: string; mentions: Mention[] };
    try {
      const cleaned = rawContent.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse LLM response", raw: rawContent.text },
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
      model_used: "claude-haiku-4-5-20251001",
    };

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
