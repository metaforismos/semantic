import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { verifyAgency } from "@/lib/tracker/agency-verifier";

export const maxDuration = 120;

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return out;
}

type AgencyRow = {
  id: string;
  agency_name: string;
  agency_url: string | null;
  evidence: { phrase?: string } | null;
  hotel_name: string | null;
};

export async function POST(request: NextRequest) {
  let body: { limit?: number; reverify?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body ok */
  }
  const limit = Math.max(1, Math.min(100, body.limit ?? 20));
  const whereClause = body.reverify
    ? ""
    : "WHERE a.verified_at IS NULL";

  try {
    const candidates = await pool.query<AgencyRow>(
      `SELECT a.id, a.agency_name, a.agency_url, a.evidence,
              h.canonical_name AS hotel_name
       FROM tracker_hotel_agency a
       LEFT JOIN tracker_hotels h ON h.id = a.hotel_id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $1`,
      [limit]
    );

    if (candidates.rowCount === 0) {
      return NextResponse.json({
        processed: 0,
        agencies: 0,
        platforms: 0,
        noise: 0,
        failed: 0,
      });
    }

    const started = Date.now();
    const results = await runWithConcurrency(candidates.rows, 3, async (row) => {
      try {
        const v = await verifyAgency({
          agency_name: row.agency_name,
          agency_url: row.agency_url,
          phrase: row.evidence?.phrase ?? null,
          hotel_name: row.hotel_name,
        });

        if (v.verdict === "noise") {
          // Purga inmediata — no nos sirve para nada en el catálogo.
          await pool.query(`DELETE FROM tracker_hotel_agency WHERE id = $1`, [
            row.id,
          ]);
        } else {
          await pool.query(
            `UPDATE tracker_hotel_agency
             SET verified_at = NOW(),
                 llm_verdict = $2,
                 llm_reasoning = $3
             WHERE id = $1`,
            [row.id, v.verdict, v.reasoning]
          );
        }
        return { id: row.id, verdict: v.verdict };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { id: row.id, error: msg };
      }
    });

    const summary = {
      processed: results.length,
      agencies: results.filter((r) => "verdict" in r && r.verdict === "agency")
        .length,
      platforms: results.filter(
        (r) => "verdict" in r && r.verdict === "platform"
      ).length,
      noise: results.filter((r) => "verdict" in r && r.verdict === "noise")
        .length,
      failed: results.filter((r) => "error" in r).length,
      duration_ms: Date.now() - started,
    };
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[agencies/verify]", err);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}
