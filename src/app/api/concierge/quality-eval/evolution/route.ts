import pool from "@/lib/db";
import { callLLM } from "@/lib/llm";
import { safeParseJSON } from "@/lib/parse";

export const maxDuration = 60;

// POST: Compare two evaluations and generate evolution analysis
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { previous_id, current_id } = body;

    if (!previous_id || !current_id) {
      return Response.json({ error: "Both previous_id and current_id are required" }, { status: 400 });
    }

    const result = await pool.query(
      `SELECT id, period_start, period_end, total_conversations, overall_quality_score,
              dimension_scores, proposals_count, notes, report_data
       FROM quality_evaluations
       WHERE id IN ($1, $2)
       ORDER BY created_at ASC`,
      [previous_id, current_id]
    );

    if (result.rows.length < 2) {
      return Response.json({ error: "One or both evaluations not found" }, { status: 404 });
    }

    const previous = result.rows[0];
    const current = result.rows[1];
    const prevReport = previous.report_data;
    const currReport = current.report_data;

    // Build concise summaries for LLM comparison
    const prevSummary = buildEvalSummary(prevReport, "previous");
    const currSummary = buildEvalSummary(currReport, "current");

    const systemPrompt = `Eres un analista de calidad conversacional para un pipeline multi-agente de concierge de hotel.

Tu tarea es comparar dos evaluaciones de calidad y generar un análisis de evolución.

Responde SOLO con JSON válido, sin texto adicional.

Formato de salida:
{
  "overall_trend": "improved" | "declined" | "stable",
  "overall_delta": <number>,
  "headline": "<1 sentence summary of the evolution in Spanish>",
  "dimension_changes": [
    {
      "dimension": "<name>",
      "previous_score": <number>,
      "current_score": <number>,
      "delta": <number>,
      "trend": "improved" | "declined" | "stable",
      "insight": "<1 sentence explaining why, in Spanish>"
    }
  ],
  "worker_changes": [
    {
      "worker": "<name>",
      "previous_issues": <number>,
      "current_issues": <number>,
      "insight": "<1 sentence in Spanish>"
    }
  ],
  "proposals_impact": "<2-3 sentences in Spanish analyzing whether previous proposals seem to have had effect>",
  "recommendations": ["<actionable recommendation in Spanish>"]
}`;

    const userMessage = `## Evaluación Anterior
${prevSummary}

## Evaluación Actual
${currSummary}

Compara ambas evaluaciones y genera el análisis de evolución.`;

    const llmResult = await callLLM({
      modelId: "gemini-flash",
      systemPrompt,
      userMessage,
      maxTokens: 4096,
    });

    const analysis = safeParseJSON(llmResult.text);

    return Response.json({
      analysis,
      previous: {
        id: previous.id,
        period_start: previous.period_start?.toISOString().split("T")[0],
        period_end: previous.period_end?.toISOString().split("T")[0],
        total_conversations: previous.total_conversations,
        overall_quality_score: parseFloat(previous.overall_quality_score),
      },
      current: {
        id: current.id,
        period_start: current.period_start?.toISOString().split("T")[0],
        period_end: current.period_end?.toISOString().split("T")[0],
        total_conversations: current.total_conversations,
        overall_quality_score: parseFloat(current.overall_quality_score),
      },
    });
  } catch (err) {
    console.error("[Evolution] Error:", err);
    return Response.json({ error: `Failed to generate evolution analysis: ${(err as Error).message}` }, { status: 500 });
  }
}

function buildEvalSummary(report: Record<string, unknown>, label: string): string {
  const meta = report.meta as Record<string, unknown>;
  const dimensions = report.dimensions as Array<Record<string, unknown>>;
  const workerAttr = report.worker_attributions as Array<Record<string, unknown>>;
  const proposals = report.proposals as Array<Record<string, unknown>>;

  const dimLines = (dimensions || [])
    .map((d) => `- ${d.dimension}: score=${d.avg_score}, issues=${d.total_issues}, rate=${d.rate}`)
    .join("\n");

  const workerLines = (workerAttr || [])
    .slice(0, 5)
    .map((w) => {
      const byDim = w.by_dimension as Record<string, number>;
      const dims = Object.entries(byDim || {})
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${k}(${v})`)
        .join(", ");
      return `- ${w.worker}: ${w.total_issues} issues (${dims})`;
    })
    .join("\n");

  const proposalLines = (proposals || [])
    .slice(0, 5)
    .map((p) => `- [${p.priority}] ${p.target_worker}: ${p.category} — ${(p.problem as string || "").slice(0, 100)}`)
    .join("\n");

  return `Período: ${meta?.period_start} → ${meta?.period_end}
Conversaciones: ${meta?.total_conversations}
Score general: ${report.overall_quality_score}
Notas: ${meta?.notes || "ninguna"}

### Dimensiones
${dimLines}

### Workers con más problemas
${workerLines}

### Propuestas (${(proposals || []).length} total)
${proposalLines}`;
}
