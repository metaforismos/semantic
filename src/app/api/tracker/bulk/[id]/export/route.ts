import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "bad_id" }, { status: 400 });
  }
  const format = new URL(request.url).searchParams.get("format") || "csv";

  const res = await pool.query<{
    idx: number;
    url: string;
    status: string;
    error: string | null;
    hotel_id: string | null;
    input: Record<string, unknown>;
    result_summary: Record<string, unknown> | null;
  }>(
    `SELECT idx, url, status, error, hotel_id, input, result_summary
     FROM tracker_bulk_job_items
     WHERE job_id = $1
     ORDER BY idx ASC`,
    [id]
  );

  if (format === "json") {
    return NextResponse.json({ items: res.rows });
  }

  const headers = [
    "idx",
    "url",
    "status",
    "hotel_id",
    "final_url",
    "http_status",
    "duration_ms",
    "title",
    "detections_count",
    "resources_count",
    "insecure_tls",
    "booking_engine",
    "cms",
    "input_name",
    "input_city",
    "input_country",
    "input_external_id",
    "input_is_customer",
    "error",
  ];
  const lines: string[] = [headers.join(",")];
  for (const r of res.rows) {
    const s = r.result_summary || {};
    const i = r.input || {};
    lines.push(
      [
        r.idx,
        r.url,
        r.status,
        r.hotel_id || "",
        s.final_url || "",
        s.status ?? "",
        s.duration_ms ?? "",
        s.title ?? "",
        s.detections_count ?? "",
        s.resources_count ?? "",
        s.insecure_tls ?? "",
        s.booking_engine ?? "",
        s.cms ?? "",
        i.name ?? "",
        i.city ?? "",
        i.country ?? "",
        i.external_id ?? "",
        i.is_customer ?? "",
        r.error ?? "",
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="tracker-bulk-${id.slice(0, 8)}.csv"`,
    },
  });
}
