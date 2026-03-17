import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildValidationSystemPrompt } from "@/lib/prompts";
import { Subtopic, ProposalValidation } from "@/lib/types";
import poolData from "@/data/subtopics_pool.json";

const pool = poolData as Subtopic[];

export async function POST(req: NextRequest) {
  try {
    const { proposed_subtopic, source_text, proposed_area, proposed_dimension } = await req.json();

    if (!proposed_subtopic) {
      return NextResponse.json({ error: "Missing proposed_subtopic" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const client = new Anthropic({ apiKey });
    const systemPrompt = buildValidationSystemPrompt(pool);

    const userMessage = `Proposed Subtopic: ${proposed_subtopic}
Source text: "${source_text}"
Suggested area: ${proposed_area}
Suggested dimension: ${proposed_dimension}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const rawContent = response.content[0];
    if (rawContent.type !== "text") {
      return NextResponse.json({ error: "Unexpected response type" }, { status: 500 });
    }

    let parsed: ProposalValidation;
    try {
      const cleaned = rawContent.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse LLM response", raw: rawContent.text },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
