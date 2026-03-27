import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// DELETE — remove all data for a player (scores, games, responses, progress)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const client = await pool.connect();
  try {
    const { name } = await params;
    const playerName = decodeURIComponent(name);

    await client.query("BEGIN");
    await client.query("DELETE FROM learning_responses WHERE player_name = $1", [playerName]);
    await client.query("DELETE FROM learning_games WHERE player_name = $1", [playerName]);
    await client.query("DELETE FROM learning_progress WHERE player_name = $1", [playerName]);
    const result = await client.query("DELETE FROM learning_scores WHERE player_name = $1", [playerName]);
    await client.query("COMMIT");

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, player_name: playerName });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[Learning Player DELETE]", err);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  } finally {
    client.release();
  }
}

// GET — player stats + category breakdown for radar chart
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const playerName = decodeURIComponent(name);

    const [playerResult, categoryResult, gamesResult] = await Promise.all([
      pool.query(
        `SELECT player_name, total_score, games_played, best_score, highest_question, updated_at
         FROM learning_scores WHERE player_name = $1`,
        [playerName]
      ),
      pool.query(
        `SELECT category,
                COUNT(*)::int as total,
                SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::int as correct
         FROM learning_responses
         WHERE player_name = $1
         GROUP BY category
         ORDER BY total DESC`,
        [playerName]
      ),
      pool.query(
        `SELECT score, questions_answered, walked_away, played_at
         FROM learning_games
         WHERE player_name = $1
         ORDER BY played_at DESC
         LIMIT 10`,
        [playerName]
      ),
    ]);

    if (playerResult.rows.length === 0) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const categoryStats = categoryResult.rows.map((r) => ({
      category: r.category,
      correct: r.correct,
      total: r.total,
      pct: r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0,
    }));

    return NextResponse.json({
      player: playerResult.rows[0],
      category_stats: categoryStats,
      recent_games: gamesResult.rows,
    });
  } catch (err) {
    console.error("[Learning Player GET]", err);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}
