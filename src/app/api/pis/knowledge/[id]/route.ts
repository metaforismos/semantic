import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const entryId = parseInt(id, 10);
  if (isNaN(entryId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { category, title, content, author } = body;

    const result = await pool.query(
      `UPDATE pis_knowledge
       SET category = COALESCE($1, category),
           title = COALESCE($2, title),
           content = COALESCE($3, content),
           author = COALESCE($4, author),
           updated_at = NOW()
       WHERE id = $5
       RETURNING id, updated_at`,
      [category, title, content, author, entryId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error("[PIS Knowledge PUT]", err);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const entryId = parseInt(id, 10);
  if (isNaN(entryId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  try {
    await pool.query("DELETE FROM pis_knowledge WHERE id = $1", [entryId]);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[PIS Knowledge DELETE]", err);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}
