import { NextRequest, NextResponse } from "next/server";
import { checkCompliance } from "@/lib/whatsapp/compliance";
import type { GeneratedTemplate } from "@/lib/whatsapp/types";

export async function POST(req: NextRequest) {
  try {
    const { templates }: { templates: GeneratedTemplate[] } = await req.json();

    if (!Array.isArray(templates)) {
      return NextResponse.json({ error: "Expected templates array" }, { status: 400 });
    }

    const results = templates.map((t) => ({
      language: t.language,
      name: t.name,
      compliance: checkCompliance(t),
    }));

    const allPassed = results.every((r) => r.compliance.passed);

    return NextResponse.json({ results, all_passed: allPassed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
