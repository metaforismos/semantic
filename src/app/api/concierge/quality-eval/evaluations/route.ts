import pool from "@/lib/db";
import type { QualityEvalReport } from "@/lib/concierge/quality-types";

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quality_evaluations (
      id SERIAL PRIMARY KEY,
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      total_conversations INT NOT NULL,
      hotel_count INT NOT NULL,
      overall_quality_score NUMERIC(4,2) NOT NULL,
      dimension_scores JSONB NOT NULL DEFAULT '{}',
      proposals_count INT NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      report_data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// GET: List all evaluations (summary only, no full report_data)
export async function GET() {
  try {
    await ensureTable();

    const result = await pool.query(`
      SELECT id, period_start, period_end, total_conversations, hotel_count,
             overall_quality_score, dimension_scores, proposals_count, notes, created_at
      FROM quality_evaluations
      ORDER BY created_at DESC
    `);

    const evaluations = result.rows.map((r) => ({
      id: r.id,
      period_start: r.period_start?.toISOString().split("T")[0],
      period_end: r.period_end?.toISOString().split("T")[0],
      total_conversations: r.total_conversations,
      hotel_count: r.hotel_count,
      overall_quality_score: parseFloat(r.overall_quality_score),
      dimension_scores: r.dimension_scores,
      proposals_count: r.proposals_count,
      notes: r.notes,
      created_at: r.created_at?.toISOString(),
    }));

    return Response.json({ evaluations });
  } catch (err) {
    console.error("[QualityEvals GET] Error:", err);
    return Response.json({ error: "Failed to load evaluations" }, { status: 500 });
  }
}

// POST: Save a new evaluation
export async function POST(request: Request) {
  try {
    await ensureTable();

    const body = await request.json();
    const report: QualityEvalReport = body.report;

    if (!report || !report.meta) {
      return Response.json({ error: "Invalid report data" }, { status: 400 });
    }

    // Extract dimension scores for quick access
    const dimensionScores: Record<string, number> = {};
    for (const dim of report.dimensions) {
      dimensionScores[dim.dimension] = dim.avg_score;
    }

    const result = await pool.query(
      `INSERT INTO quality_evaluations
        (period_start, period_end, total_conversations, hotel_count,
         overall_quality_score, dimension_scores, proposals_count, notes, report_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        report.meta.period_start,
        report.meta.period_end,
        report.meta.total_conversations,
        report.meta.hotel_count,
        report.overall_quality_score,
        JSON.stringify(dimensionScores),
        report.proposals.length,
        report.meta.notes || "",
        JSON.stringify(report),
      ]
    );

    return Response.json({ id: result.rows[0].id });
  } catch (err) {
    console.error("[QualityEvals POST] Error:", err);
    return Response.json({ error: "Failed to save evaluation" }, { status: 500 });
  }
}
