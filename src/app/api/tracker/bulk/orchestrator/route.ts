import { NextResponse } from "next/server";
import pool from "@/lib/db";
import {
  getOrchestratorState,
  startOrchestrator,
  stopOrchestrator,
} from "@/lib/tracker/bulk-orchestrator";

export const dynamic = "force-dynamic";

// Watchdog: if the orchestrator is not running but there is pending work,
// restart it. Keeps the system self-healing across deploys/restarts when
// the UI (or anything else) polls this endpoint. Disabled via env var.
async function watchdog() {
  if (process.env.TRACKER_ORCHESTRATOR_AUTOSTART === "0") return;
  const state = getOrchestratorState();
  if (state.running) return;
  try {
    const r = await pool.query<{ pending: number }>(
      `SELECT COUNT(*)::int AS pending
       FROM tracker_bulk_job_items
       WHERE status = 'pending'`
    );
    if ((r.rows[0]?.pending ?? 0) > 0) {
      startOrchestrator();
    }
  } catch {
    /* ignore — next poll retries */
  }
}

export async function GET() {
  await watchdog();
  return NextResponse.json(getOrchestratorState());
}

export async function POST() {
  const r = startOrchestrator();
  return NextResponse.json(r);
}

export async function DELETE() {
  const r = stopOrchestrator();
  return NextResponse.json(r);
}
