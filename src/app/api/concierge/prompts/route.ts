import pool from "@/lib/db";
import type { PipelinePrompt } from "@/lib/concierge/quality-types";

// Auto-create table if it doesn't exist
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pipeline_prompts (
      id SERIAL PRIMARY KEY,
      prompt_key TEXT NOT NULL,
      version TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active',
      system_template TEXT NOT NULL DEFAULT '',
      user_template TEXT NOT NULL DEFAULT '',
      system_size INT NOT NULL DEFAULT 0,
      user_size INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      uploaded_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(prompt_key, version)
    )
  `);
}

// GET: Return latest version of each prompt
export async function GET() {
  try {
    await ensureTable();

    // For each prompt_key, get only the row with the highest version (lexicographic semver)
    const result = await pool.query(`
      SELECT DISTINCT ON (prompt_key)
        prompt_key, version, status, system_template, user_template,
        system_size, user_size, created_at, updated_at, uploaded_at
      FROM pipeline_prompts
      ORDER BY prompt_key, version DESC
    `);

    const prompts: PipelinePrompt[] = result.rows.map((r) => ({
      prompt_key: r.prompt_key,
      version: r.version,
      status: r.status,
      system_template: r.system_template,
      user_template: r.user_template,
      system_size: r.system_size,
      user_size: r.user_size,
      created_at: r.created_at?.toISOString() || "",
      updated_at: r.updated_at?.toISOString() || "",
    }));

    return Response.json({ prompts });
  } catch (err) {
    console.error("[Prompts GET] Error:", err);
    return Response.json({ error: "Failed to load prompts" }, { status: 500 });
  }
}

// POST: Upsert prompts from CSV upload (replaces matching prompt_key+version, inserts new ones)
export async function POST(request: Request) {
  try {
    await ensureTable();

    const body = await request.json();
    const prompts: PipelinePrompt[] = body.prompts;

    if (!Array.isArray(prompts) || prompts.length === 0) {
      return Response.json({ error: "No prompts provided" }, { status: 400 });
    }

    let upserted = 0;
    for (const p of prompts) {
      await pool.query(
        `INSERT INTO pipeline_prompts (prompt_key, version, status, system_template, user_template, system_size, user_size, created_at, updated_at, uploaded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (prompt_key, version) DO UPDATE SET
           status = EXCLUDED.status,
           system_template = EXCLUDED.system_template,
           user_template = EXCLUDED.user_template,
           system_size = EXCLUDED.system_size,
           user_size = EXCLUDED.user_size,
           updated_at = EXCLUDED.updated_at,
           uploaded_at = NOW()`,
        [
          p.prompt_key,
          p.version,
          p.status,
          p.system_template,
          p.user_template,
          p.system_size,
          p.user_size,
          p.created_at || new Date().toISOString(),
          p.updated_at || new Date().toISOString(),
        ]
      );
      upserted++;
    }

    return Response.json({ upserted });
  } catch (err) {
    console.error("[Prompts POST] Error:", err);
    return Response.json({ error: "Failed to save prompts" }, { status: 500 });
  }
}
