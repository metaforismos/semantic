import pool from "@/lib/db";

// GET: Fetch a single evaluation with full report_data
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const evalId = parseInt(id, 10);
    if (isNaN(evalId)) {
      return Response.json({ error: "Invalid evaluation ID" }, { status: 400 });
    }

    const result = await pool.query(
      `SELECT id, period_start, period_end, total_conversations, hotel_count,
              overall_quality_score, dimension_scores, proposals_count, notes,
              report_data, created_at
       FROM quality_evaluations
       WHERE id = $1`,
      [evalId]
    );

    if (result.rows.length === 0) {
      return Response.json({ error: "Evaluation not found" }, { status: 404 });
    }

    const r = result.rows[0];
    return Response.json({
      id: r.id,
      period_start: r.period_start?.toISOString().split("T")[0],
      period_end: r.period_end?.toISOString().split("T")[0],
      total_conversations: r.total_conversations,
      hotel_count: r.hotel_count,
      overall_quality_score: parseFloat(r.overall_quality_score),
      dimension_scores: r.dimension_scores,
      proposals_count: r.proposals_count,
      notes: r.notes,
      report: r.report_data,
      created_at: r.created_at?.toISOString(),
    });
  } catch (err) {
    console.error("[QualityEvals GET by ID] Error:", err);
    return Response.json({ error: "Failed to load evaluation" }, { status: 500 });
  }
}
