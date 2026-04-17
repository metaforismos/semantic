import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role")?.trim() || null;
  const classified = searchParams.get("classified"); // 'true' | 'false' | null
  const q = searchParams.get("q")?.trim() || null;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(
    200,
    Math.max(1, parseInt(searchParams.get("page_size") || "50", 10))
  );
  const offset = (page - 1) * pageSize;

  const where: string[] = [];
  const values: unknown[] = [];
  if (role) {
    values.push(role);
    where.push(`primary_role = $${values.length}`);
  }
  if (classified === "true") {
    where.push(`classified_by IS NOT NULL`);
  } else if (classified === "false") {
    where.push(`classified_by IS NULL`);
  }
  if (q) {
    values.push(`%${q}%`);
    where.push(`(registrable_domain ILIKE $${values.length} OR vendor_name ILIKE $${values.length})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS n FROM tracker_resources ${whereSql}`,
      values
    );
    const rolesRes = await pool.query(
      `SELECT primary_role, COUNT(*)::int AS n
       FROM tracker_resources
       WHERE primary_role IS NOT NULL
       GROUP BY primary_role
       ORDER BY n DESC`
    );
    const classificationRes = await pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE classified_by IS NOT NULL)::int AS classified,
         COUNT(*) FILTER (WHERE classified_by IS NULL)::int AS unclassified
       FROM tracker_resources`
    );

    values.push(pageSize, offset);
    const listRes = await pool.query(
      `SELECT registrable_domain, primary_role, observed_hotels, observed_contexts,
              vendor_name, vendor_product, classified_by, classified_at, last_seen_at
       FROM tracker_resources
       ${whereSql}
       ORDER BY observed_hotels DESC, registrable_domain ASC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    return NextResponse.json({
      resources: listRes.rows,
      page,
      page_size: pageSize,
      total: countRes.rows[0].n,
      total_pages: Math.ceil(countRes.rows[0].n / pageSize),
      roles: rolesRes.rows,
      classification: classificationRes.rows[0],
    });
  } catch (err) {
    console.error("[Tracker Resources GET]", err);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}
