import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// POST — initialize session or record an answer
export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await request.json();
    const { player_name, init, question_id, is_correct, category, skip } = body as {
      player_name: string;
      init?: boolean;
      question_id?: string;
      is_correct?: boolean;
      category?: string;
      skip?: boolean; // timeout skip — advance index but don't record
      question_order?: string[];
    };

    if (!player_name) {
      return NextResponse.json({ error: "missing_player_name" }, { status: 400 });
    }

    await client.query("BEGIN");

    if (init && body.question_order) {
      // Initialize or reset training session
      await client.query(
        `INSERT INTO learning_progress (player_name, question_order, current_index, answered_ids, correct_ids, completed, updated_at)
         VALUES ($1, $2, 0, ARRAY[]::TEXT[], ARRAY[]::TEXT[], FALSE, NOW())
         ON CONFLICT (player_name) DO UPDATE SET
           question_order = CASE
             WHEN learning_progress.completed THEN $2
             ELSE learning_progress.question_order
           END,
           current_index = CASE
             WHEN learning_progress.completed THEN 0
             ELSE learning_progress.current_index
           END,
           answered_ids = CASE
             WHEN learning_progress.completed THEN ARRAY[]::TEXT[]
             ELSE learning_progress.answered_ids
           END,
           correct_ids = CASE
             WHEN learning_progress.completed THEN ARRAY[]::TEXT[]
             ELSE learning_progress.correct_ids
           END,
           completed = CASE
             WHEN learning_progress.completed THEN FALSE
             ELSE learning_progress.completed
           END,
           updated_at = NOW()`,
        [player_name, body.question_order]
      );

      // Fetch the (possibly existing) progress
      const result = await client.query(
        `SELECT * FROM learning_progress WHERE player_name = $1`,
        [player_name]
      );

      await client.query("COMMIT");
      const row = result.rows[0];
      return NextResponse.json({
        success: true,
        progress: {
          player_name: row.player_name,
          answered_ids: row.answered_ids || [],
          correct_ids: row.correct_ids || [],
          current_index: row.current_index,
          question_order: row.question_order || [],
          completed: row.completed,
        },
      });
    }

    if (skip && question_id) {
      // Timeout skip — advance current_index only
      await client.query(
        `UPDATE learning_progress
         SET current_index = current_index + 1, updated_at = NOW()
         WHERE player_name = $1`,
        [player_name]
      );

      await client.query("COMMIT");
      return NextResponse.json({ success: true, skipped: true });
    }

    if (question_id != null && is_correct != null) {
      // Record answer
      const answeredUpdate = is_correct
        ? `answered_ids = array_append(answered_ids, $2),
           correct_ids = array_append(correct_ids, $2)`
        : `answered_ids = array_append(answered_ids, $2)`;

      // Check if this completes the training (current_index + 1 >= array_length)
      await client.query(
        `UPDATE learning_progress
         SET ${answeredUpdate},
             current_index = current_index + 1,
             completed = (current_index + 1 >= array_length(question_order, 1)),
             updated_at = NOW()
         WHERE player_name = $1`,
        [player_name, question_id]
      );

      // Also insert into learning_responses for radar chart tracking
      // We need a game_id — use a convention: game_id = 0 for training mode
      // Actually, let's insert into learning_responses without game_id constraint
      // by inserting a training game record if needed
      if (category) {
        // Upsert a persistent "training" game record for this player
        const gameResult = await client.query(
          `INSERT INTO learning_games (player_name, score, questions_answered, walked_away)
           VALUES ($1, 0, 0, FALSE)
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [player_name]
        );

        let gameId: number;
        if (gameResult.rows.length > 0) {
          gameId = gameResult.rows[0].id;
        } else {
          // Get existing latest game
          const existing = await client.query(
            `SELECT id FROM learning_games WHERE player_name = $1 ORDER BY id DESC LIMIT 1`,
            [player_name]
          );
          gameId = existing.rows[0]?.id ?? 1;
        }

        await client.query(
          `INSERT INTO learning_responses (game_id, player_name, question_id, category, is_correct)
           VALUES ($1, $2, $3, $4, $5)`,
          [gameId, player_name, question_id, category, is_correct]
        );

        // Upsert aggregate scores for Skills page
        await client.query(
          `INSERT INTO learning_scores (player_name, total_score, games_played, best_score, highest_question, updated_at)
           VALUES ($1, CASE WHEN $2 THEN 1 ELSE 0 END, 0, 0, 0, NOW())
           ON CONFLICT (player_name) DO UPDATE SET
             total_score = CASE WHEN $2 THEN learning_scores.total_score + 1 ELSE learning_scores.total_score END,
             updated_at = NOW()`,
          [player_name, is_correct]
        );
      }

      await client.query("COMMIT");
      return NextResponse.json({ success: true, recorded: true });
    }

    await client.query("ROLLBACK");
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[Learning Progress POST]", err);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  } finally {
    client.release();
  }
}
