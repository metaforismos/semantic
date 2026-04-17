import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { fetchHtml, normalizeUrl } from "@/lib/tracker/fetcher";
import { detect } from "@/lib/tracker/detector";
import type { AnalyzeResult } from "@/lib/tracker/types";

export const maxDuration = 60;

async function persistAnalysis(
  result: AnalyzeResult,
  explicitHotelId: string | null
): Promise<{ hotel_id: string; created: boolean }> {
  const hostHint = (() => {
    try {
      return new URL(result.final_url).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  })();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let hotelId = explicitHotelId;
    let created = false;

    if (!hotelId) {
      const byUrl = await client.query<{ hotel_id: string }>(
        `SELECT hotel_id FROM tracker_hotel_urls WHERE url = $1 LIMIT 1`,
        [result.final_url]
      );
      if (byUrl.rowCount) {
        hotelId = byUrl.rows[0].hotel_id;
      } else {
        const canonical = result.title || hostHint || result.final_url;
        const ins = await client.query<{ id: string }>(
          `INSERT INTO tracker_hotels (canonical_name, website_url)
           VALUES ($1, $2)
           RETURNING id`,
          [canonical.slice(0, 300), result.final_url]
        );
        hotelId = ins.rows[0].id;
        created = true;
      }
    }

    await client.query(
      `INSERT INTO tracker_hotel_urls (hotel_id, url, kind, verified_at, confidence)
       VALUES ($1, $2, 'official', NOW(), 0.8)
       ON CONFLICT (hotel_id, url) DO UPDATE SET verified_at = NOW()`,
      [hotelId, result.final_url]
    );

    if (created || explicitHotelId) {
      await client.query(
        `UPDATE tracker_hotels
         SET website_url = COALESCE(website_url, $2),
             last_enriched_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [hotelId, result.final_url]
      );
    } else {
      await client.query(
        `UPDATE tracker_hotels SET last_enriched_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [hotelId]
      );
    }

    // Mark previous detections for these (category,vendor) as inactive + insert fresh.
    // Keeps history in events. Simpler: DELETE + INSERT for the same analysis.
    for (const d of result.detections) {
      const prev = await client.query(
        `SELECT id, confidence FROM tracker_hotel_stack
         WHERE hotel_id = $1 AND category = $2 AND vendor = $3 AND active = TRUE`,
        [hotelId, d.category, d.vendor]
      );

      if (prev.rowCount) {
        await client.query(
          `UPDATE tracker_hotel_stack
           SET product = $2,
               confidence = $3,
               evidence_url = $4,
               evidence = $5::jsonb,
               detected_via = $6,
               last_seen_at = NOW()
           WHERE id = $1`,
          [
            prev.rows[0].id,
            d.product,
            d.confidence,
            result.final_url,
            JSON.stringify(d.evidence),
            d.detected_via,
          ]
        );
      } else {
        await client.query(
          `INSERT INTO tracker_hotel_stack
             (hotel_id, category, vendor, product, detected_via, evidence_url, evidence, confidence)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
          [
            hotelId,
            d.category,
            d.vendor,
            d.product,
            d.detected_via,
            result.final_url,
            JSON.stringify(d.evidence),
            d.confidence,
          ]
        );
      }
    }

    await client.query(
      `INSERT INTO tracker_hotel_events (hotel_id, event_type, payload)
       VALUES ($1, 'analyze', $2::jsonb)`,
      [
        hotelId,
        JSON.stringify({
          url: result.final_url,
          detections_count: result.detections.length,
          duration_ms: result.duration_ms,
        }),
      ]
    );

    await client.query(
      `INSERT INTO tracker_hotel_sources (hotel_id, source, raw)
       VALUES ($1, 'rule_analyzer_v1', $2::jsonb)`,
      [
        hotelId,
        JSON.stringify({
          url: result.url,
          final_url: result.final_url,
          status: result.status,
          title: result.title,
          meta_generator: result.meta_generator,
          detections: result.detections,
        }),
      ]
    );

    await client.query("COMMIT");
    return { hotel_id: hotelId!, created };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest) {
  let body: { url?: string; save?: boolean; hotel_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const url = normalizeUrl(body.url || "");
  if (!url) {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }

  const fetched = await fetchHtml(url, { timeoutMs: 15000 });
  if (!fetched.ok) {
    return NextResponse.json(
      {
        url,
        error: fetched.error,
        status: fetched.status ?? null,
        duration_ms: fetched.duration_ms,
      },
      { status: 502 }
    );
  }

  const parsed = detect(fetched.html, fetched.final_url);
  const result: AnalyzeResult = {
    url,
    fetched_at: new Date().toISOString(),
    duration_ms: fetched.duration_ms,
    status: fetched.status,
    ...parsed,
  };

  let persisted: { hotel_id: string; created: boolean } | null = null;
  if (body.save) {
    try {
      persisted = await persistAnalysis(result, body.hotel_id ?? null);
    } catch (err) {
      console.error("[tracker.analyze.persist]", err);
      return NextResponse.json(
        { ...result, persist_error: "db_error" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    ...result,
    persisted,
  });
}
