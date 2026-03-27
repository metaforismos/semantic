import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// GET — leaderboard sorted by total_score
export async function GET() {
  try {
    const result = await pool.query(
      `SELECT ls.player_name, ls.total_score, ls.games_played, ls.best_score, ls.highest_question, ls.updated_at,
              COALESCE(r.total_answers, 0)::int AS total_answers,
              COALESCE(r.correct_answers, 0)::int AS correct_answers
       FROM learning_scores ls
       LEFT JOIN (
         SELECT player_name,
                COUNT(*)::int AS total_answers,
                SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::int AS correct_answers
         FROM learning_responses
         GROUP BY player_name
       ) r ON ls.player_name = r.player_name
       ORDER BY CASE WHEN COALESCE(r.total_answers, 0) > 0 THEN COALESCE(r.correct_answers, 0)::float / r.total_answers ELSE 0 END DESC, ls.total_score DESC
       LIMIT 50`
    );
    return NextResponse.json({ scores: result.rows });
  } catch (err) {
    console.error("[Learning Scores GET]", err);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}

// POST — save game result (transaction: game + responses + upsert scores)
export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await request.json();
    const {
      player_name,
      score,
      questions_answered,
      walked_away,
      responses,
    } = body as {
      player_name: string;
      score: number;
      questions_answered: number;
      walked_away: boolean;
      responses: { question_id: string; category: string; is_correct: boolean }[];
    };

    if (!player_name || score == null) {
      return NextResponse.json({ error: "invalid_data" }, { status: 400 });
    }

    await client.query("BEGIN");

    // 1. Insert game record
    const gameResult = await client.query(
      `INSERT INTO learning_games (player_name, score, questions_answered, walked_away)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [player_name, score, questions_answered, walked_away]
    );
    const gameId = gameResult.rows[0].id;

    // 2. Batch insert responses
    if (responses && responses.length > 0) {
      const values: unknown[] = [];
      const placeholders: string[] = [];
      responses.forEach((r, i) => {
        const offset = i * 5;
        placeholders.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`
        );
        values.push(gameId, player_name, r.question_id, r.category, r.is_correct);
      });
      await client.query(
        `INSERT INTO learning_responses (game_id, player_name, question_id, category, is_correct)
         VALUES ${placeholders.join(", ")}`,
        values
      );
    }

    // 3. Upsert aggregate scores
    await client.query(
      `INSERT INTO learning_scores (player_name, total_score, games_played, best_score, highest_question, updated_at)
       VALUES ($1, $2::bigint, 1, $3::int, $4::int, NOW())
       ON CONFLICT (player_name) DO UPDATE SET
         total_score = learning_scores.total_score + $2::bigint,
         games_played = learning_scores.games_played + 1,
         best_score = GREATEST(learning_scores.best_score, $3::int),
         highest_question = GREATEST(learning_scores.highest_question, $4::int),
         updated_at = NOW()`,
      [player_name, score, score, questions_answered]
    );

    await client.query("COMMIT");
    return NextResponse.json({ success: true, game_id: gameId });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[Learning Scores POST]", err);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  } finally {
    client.release();
  }
}
