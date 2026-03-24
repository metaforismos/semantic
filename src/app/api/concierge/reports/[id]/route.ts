import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// GET — get full report by ID
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const reportId = parseInt(id, 10);
  if (isNaN(reportId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `SELECT id, hotel_name, hotel_id, concierge_name, period_start, period_end,
              total_conversations, active_conversations, report_data, notes, created_at, created_by
       FROM pilot_reports WHERE id = $1`,
      [reportId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({ report: result.rows[0] });
  } catch (err) {
    console.error("[Report GET by ID]", err);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}

// DELETE — delete a report
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const reportId = parseInt(id, 10);
  if (isNaN(reportId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  try {
    await pool.query("DELETE FROM pilot_reports WHERE id = $1", [reportId]);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[Report DELETE]", err);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}
