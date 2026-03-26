import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// GET /api/concierge/analyze/status?job_id=xxx
export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("job_id");
  if (!jobId) {
    return NextResponse.json({ error: "Missing job_id" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `SELECT job_id, status, total_batches, completed_batches, failed_batches, analyses
       FROM analysis_jobs WHERE job_id = $1`,
      [jobId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const job = result.rows[0];
    return NextResponse.json({
      job_id: job.job_id,
      status: job.status,
      total_batches: job.total_batches,
      completed_batches: job.completed_batches,
      failed_batches: job.failed_batches,
      analyses: job.analyses,
    });
  } catch (err) {
    console.error("[Job Status]", err);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}
