import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// GET — fetch user's training progress
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const playerName = decodeURIComponent(name);

    const result = await pool.query(
      `SELECT player_name, answered_ids, correct_ids, current_index,
              question_order, completed, updated_at
       FROM learning_progress WHERE player_name = $1`,
      [playerName]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ progress: null });
    }

    const row = result.rows[0];
    return NextResponse.json({
      progress: {
        player_name: row.player_name,
        answered_ids: row.answered_ids || [],
        correct_ids: row.correct_ids || [],
        current_index: row.current_index,
        question_order: row.question_order || [],
        completed: row.completed,
        updated_at: row.updated_at,
      },
      answered_count: (row.answered_ids || []).length,
      correct_count: (row.correct_ids || []).length,
      total: (row.question_order || []).length,
    });
  } catch (err) {
    console.error("[Learning Progress GET]", err);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}
