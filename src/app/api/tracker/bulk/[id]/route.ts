import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "bad_id" }, { status: 400 });
  }

  try {
    const jobRes = await pool.query(
      `SELECT id, label, total, status, created_at, started_at, finished_at
       FROM tracker_bulk_jobs WHERE id = $1`,
      [id]
    );
    if (!jobRes.rowCount) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const itemsRes = await pool.query(
      `SELECT id, idx, url, input, status, hotel_id, result_summary, error,
              started_at, finished_at
       FROM tracker_bulk_job_items
       WHERE job_id = $1
       ORDER BY idx ASC`,
      [id]
    );

    const counts = await pool.query<{
      pending: number;
      running: number;
      done: number;
      error: number;
      skipped: number;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
         COUNT(*) FILTER (WHERE status = 'running')::int AS running,
         COUNT(*) FILTER (WHERE status = 'done')::int AS done,
         COUNT(*) FILTER (WHERE status = 'error')::int AS error,
         COUNT(*) FILTER (WHERE status = 'skipped')::int AS skipped
       FROM tracker_bulk_job_items WHERE job_id = $1`,
      [id]
    );

    return NextResponse.json({
      job: jobRes.rows[0],
      items: itemsRes.rows,
      counts: counts.rows[0],
    });
  } catch (err) {
    console.error("[bulk/:id GET]", err);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}
