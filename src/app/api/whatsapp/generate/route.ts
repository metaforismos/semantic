import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";
import { safeParseJSON } from "@/lib/parse";
import {
  buildTemplateSystemPrompt,
  buildTemplateUserMessage,
  buildRegenerateUserMessage,
} from "@/lib/whatsapp/prompts";
import type { GenerateRequest, GeneratedTemplate, ApprovedTemplate } from "@/lib/whatsapp/types";
import pool from "@/lib/db";

async function fetchApprovedExamples(): Promise<ApprovedTemplate[]> {
  try {
    const result = await pool.query(
      "SELECT id, event, name, templates, approved_at, notes FROM whatsapp_approved_templates ORDER BY approved_at DESC LIMIT 5",
    );
    return result.rows.map((r) => ({
      ...r,
      templates: typeof r.templates === "string" ? JSON.parse(r.templates) : r.templates,
    }));
  } catch {
    // Table might not exist yet
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: GenerateRequest = await req.json();

    if (!body.event || !body.description) {
      return NextResponse.json({ error: "Missing event or description" }, { status: 400 });
    }

    const approvedExamples = await fetchApprovedExamples();
    const systemPrompt = buildTemplateSystemPrompt(approvedExamples);

    let userMessage: string;

    if (body.previous_templates && body.feedback) {
      userMessage = buildRegenerateUserMessage(
        body.event,
        body.description,
        body.previous_templates,
        body.feedback,
        body.hotel_name,
        body.include_button,
        body.button_text,
      );
    } else {
      userMessage = buildTemplateUserMessage(
        body.event,
        body.description,
        body.hotel_name,
        body.include_button,
        body.button_text,
      );
    }

    const { text, modelUsed } = await callLLM({
      modelId: "claude-sonnet",
      systemPrompt,
      userMessage,
      maxTokens: 4096,
    });

    const templates: GeneratedTemplate[] = safeParseJSON(text);

    if (!Array.isArray(templates) || templates.length !== 3) {
      return NextResponse.json(
        { error: "LLM did not return exactly 3 templates", raw: text },
        { status: 500 },
      );
    }

    // Ensure category is always UTILITY
    for (const t of templates) {
      t.category = "UTILITY";
    }

    return NextResponse.json({ templates, model_used: modelUsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[WhatsApp Generate]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
