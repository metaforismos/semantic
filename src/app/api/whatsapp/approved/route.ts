import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query(
      "SELECT id, event, name, templates, approved_at, notes FROM whatsapp_approved_templates ORDER BY approved_at DESC",
    );
    return NextResponse.json({ approved: result.rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Table might not exist yet — return empty
    if (message.includes("does not exist")) {
      return NextResponse.json({ approved: [] });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event, name, templates, notes } = body;

    if (!event || !name || !templates) {
      return NextResponse.json({ error: "Missing event, name, or templates" }, { status: 400 });
    }

    // Ensure table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_approved_templates (
        id SERIAL PRIMARY KEY,
        event TEXT NOT NULL,
        name TEXT NOT NULL,
        templates JSONB NOT NULL,
        approved_at TIMESTAMP DEFAULT NOW(),
        notes TEXT
      )
    `);

    const result = await pool.query(
      "INSERT INTO whatsapp_approved_templates (event, name, templates, notes) VALUES ($1, $2, $3, $4) RETURNING id, approved_at",
      [event, name, JSON.stringify(templates), notes || null],
    );

    return NextResponse.json({
      id: result.rows[0].id,
      approved_at: result.rows[0].approved_at,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[WhatsApp Approved]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
