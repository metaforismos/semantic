import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import type { PilotReportData } from "@/lib/concierge/types";

// GET — list all reports (summary only, no full report_data)
export async function GET() {
  try {
    const result = await pool.query(
      `SELECT id, hotel_name, hotel_id, concierge_name, period_start, period_end,
              total_conversations, active_conversations, notes, created_at, created_by
       FROM pilot_reports
       ORDER BY created_at DESC
       LIMIT 50`
    );
    return NextResponse.json({ reports: result.rows });
  } catch (err) {
    console.error("[Reports GET]", err);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}

// POST — save a new report
export async function POST(request: NextRequest) {
  try {
    const { report_data, created_by } = (await request.json()) as {
      report_data: PilotReportData;
      created_by?: string;
    };

    if (!report_data?.meta?.hotel_name) {
      return NextResponse.json({ error: "invalid_data" }, { status: 400 });
    }

    const meta = report_data.meta;

    const result = await pool.query(
      `INSERT INTO pilot_reports
        (hotel_name, hotel_id, concierge_name, period_start, period_end,
         total_conversations, active_conversations, report_data, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, created_at`,
      [
        meta.hotel_name,
        meta.hotel_id,
        meta.concierge_name,
        meta.period_start,
        meta.period_end,
        meta.total_conversations,
        meta.active_conversations,
        JSON.stringify(report_data),
        meta.notes || "",
        created_by || "CSM",
      ]
    );

    return NextResponse.json({
      id: result.rows[0].id,
      created_at: result.rows[0].created_at,
    });
  } catch (err) {
    console.error("[Reports POST]", err);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}
