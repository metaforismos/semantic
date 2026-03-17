import { NextRequest, NextResponse } from "next/server";
import { buildValidationSystemPrompt } from "@/lib/prompts";
import { callLLM } from "@/lib/llm";
import { Subtopic, ProposalValidation } from "@/lib/types";
import poolData from "@/data/subtopics_pool.json";

const pool = poolData as Subtopic[];

export async function POST(req: NextRequest) {
  try {
    const { proposed_subtopic, source_text, proposed_area, proposed_dimension, model = "claude-sonnet", customPrompt } = await req.json();

    if (!proposed_subtopic) {
      return NextResponse.json({ error: "Missing proposed_subtopic" }, { status: 400 });
    }

    const systemPrompt = buildValidationSystemPrompt(pool, customPrompt || undefined);

    const userMessage = `Proposed Subtopic: ${proposed_subtopic}
Source text: "${source_text}"
Suggested area: ${proposed_area}
Suggested dimension: ${proposed_dimension}`;

    const { text: rawText } = await callLLM({
      modelId: model,
      systemPrompt,
      userMessage,
      maxTokens: 2048,
    });

    let parsed: ProposalValidation;
    try {
      const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse LLM response", raw: rawText },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
