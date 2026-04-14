import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query(
      "SELECT id, category, title, content, author, created_at, updated_at FROM pis_knowledge ORDER BY category, created_at DESC"
    );
    return NextResponse.json({ entries: result.rows });
  } catch (err) {
    console.error("[PIS Knowledge GET]", err);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category, title, content, author } = body;

    if (!category || !title || !content) {
      return NextResponse.json(
        { error: "category, title, and content are required" },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `INSERT INTO pis_knowledge (category, title, content, author)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [category, title, content, author || ""]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error("[PIS Knowledge POST]", err);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}
