import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { Subtopic } from "@/lib/types";

const POOL_PATH = path.join(process.cwd(), "data", "subtopics_pool.json");

export async function POST(req: NextRequest) {
  try {
    const { subtopics } = (await req.json()) as {
      subtopics: Array<{
        subtopic: string;
        area: string;
        dimension: string;
        default_polarity: "positive" | "negative" | "context-dependent";
      }>;
    };

    if (!Array.isArray(subtopics) || subtopics.length === 0) {
      return NextResponse.json({ error: "No subtopics provided" }, { status: 400 });
    }

    const raw = await readFile(POOL_PATH, "utf-8");
    const pool: Subtopic[] = JSON.parse(raw);

    const existingNames = new Set(pool.map((s) => s.subtopic));
    const added: string[] = [];
    const skipped: string[] = [];

    for (const entry of subtopics) {
      if (!entry.subtopic || existingNames.has(entry.subtopic)) {
        skipped.push(entry.subtopic || "(empty)");
        continue;
      }

      pool.push({
        subtopic: entry.subtopic,
        area: entry.area,
        dimension: entry.dimension,
        default_polarity: entry.default_polarity,
        status: "active",
      });
      existingNames.add(entry.subtopic);
      added.push(entry.subtopic);
    }

    if (added.length > 0) {
      await writeFile(POOL_PATH, JSON.stringify(pool, null, 2) + "\n", "utf-8");
    }

    return NextResponse.json({
      added,
      skipped,
      pool_size: pool.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
