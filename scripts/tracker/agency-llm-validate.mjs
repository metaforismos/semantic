#!/usr/bin/env node
// Validation harness for the LLM-based agency extractor.
//
// Flow:
//   1. Pull a sample of hotel URLs (mix of "regex found" + "regex null")
//      from tracker_hotels via the Railway public DB, or read URLs from
//      a file (--urls=path).
//   2. For each URL: fetch HTML, run regex detector and LLM detector,
//      show side-by-side.
//   3. Write results to data/tracker/agency-validate-<timestamp>.json
//      for manual ground-truth labeling.
//
// Usage:
//   # Default: pull 30 hotels from DB (15 with known agency + 15 null)
//   ANTHROPIC_API_KEY=... DATABASE_URL=... \
//     node scripts/tracker/agency-llm-validate.mjs
//
//   # From explicit URL list:
//   ANTHROPIC_API_KEY=... \
//     node scripts/tracker/agency-llm-validate.mjs --urls=/tmp/urls.txt
//
//   # Sample size override:
//   ... --sample=50

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const envFile = path.resolve(repoRoot, ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, v] = a.slice(2).split("=");
      return [k, v ?? "true"];
    })
);

const sampleSize = parseInt(args.sample || "30", 10);
const urlsFile = args.urls;
// "miss" mode: only hotels where regex returned null — the gap the LLM is
// supposed to fill. Default is 50/50 (with/without agency).
const missOnly = args.miss === "true";
const outDir = path.resolve(repoRoot, "data/tracker");

if (
  !process.env.ANTHROPIC_API_KEY &&
  !process.env.GEMINI_API_KEY &&
  !process.env.OPENAI_API_KEY
) {
  console.error("At least one of ANTHROPIC_API_KEY / GEMINI_API_KEY / OPENAI_API_KEY required");
  process.exit(2);
}

// Lazily import the runtime bits so the CLI can show help without pulling
// all the heavy deps.
const [{ fetchHtml }, { detectAgency }, { detectAgencyWithLlm }] = await Promise.all([
  import("../../src/lib/tracker/fetcher.ts"),
  import("../../src/lib/tracker/agency.ts"),
  import("../../src/lib/tracker/agency-llm.ts"),
]);

async function loadUrls() {
  if (urlsFile) {
    const raw = fs.readFileSync(urlsFile, "utf8");
    return raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL required when --urls not given");
  }
  const half = missOnly ? 0 : Math.floor(sampleSize / 2);
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("railway.internal")
      ? false
      : { rejectUnauthorized: false },
  });
  await client.connect();
  // Half: hotels where an agency was already detected (regex baseline).
  const withAgency = await client.query(
    `SELECT h.website_url FROM tracker_hotels h
     WHERE h.website_url IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM tracker_hotel_agency a
         WHERE a.hotel_id = h.id AND a.agency_name IS NOT NULL
       )
     ORDER BY random()
     LIMIT $1`,
    [half]
  );
  // Half: hotels analyzed OK but no agency detected (regex miss → LLM test).
  const withoutAgency = await client.query(
    `SELECT h.website_url FROM tracker_hotels h
     WHERE h.website_url IS NOT NULL
       AND h.last_enriched_at IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM tracker_hotel_agency a WHERE a.hotel_id = h.id
       )
     ORDER BY random()
     LIMIT $1`,
    [sampleSize - half]
  );
  await client.end();
  return [
    ...withAgency.rows.map((r) => r.website_url),
    ...withoutAgency.rows.map((r) => r.website_url),
  ];
}

async function processUrl(url) {
  const started = Date.now();
  const fetchRes = await fetchHtml(url, 15000);
  if (!fetchRes.ok) {
    return {
      url,
      error: fetchRes.error,
      error_code: fetchRes.error_code ?? null,
      fetch_ms: fetchRes.duration_ms,
    };
  }
  let baseHost = "";
  try {
    baseHost = new URL(fetchRes.final_url).hostname;
  } catch {
    /* ignore */
  }

  const regexStart = Date.now();
  const regexHit = detectAgency(fetchRes.html, baseHost);
  const regex_ms = Date.now() - regexStart;

  const llmStart = Date.now();
  const llmHit = await detectAgencyWithLlm(fetchRes.html, baseHost);
  const llm_ms = Date.now() - llmStart;

  return {
    url,
    final_url: fetchRes.final_url,
    html_bytes: fetchRes.html.length,
    rendered_via_browser: fetchRes.rendered_via_browser ?? false,
    regex: regexHit
      ? { name: regexHit.name, url: regexHit.url, confidence: regexHit.confidence }
      : null,
    llm: llmHit
      ? { name: llmHit.name, url: llmHit.url, confidence: llmHit.confidence }
      : null,
    regex_ms,
    llm_ms,
    total_ms: Date.now() - started,
  };
}

async function main() {
  const urls = await loadUrls();
  console.log(`[agency-validate] ${urls.length} URLs`);

  const results = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    process.stdout.write(`[${i + 1}/${urls.length}] ${url} ... `);
    try {
      const r = await processUrl(url);
      results.push(r);
      if (r.error) {
        console.log(`ERR (${r.error_code || r.error.slice(0, 40)})`);
      } else {
        const reg = r.regex ? r.regex.name : "—";
        const llm = r.llm ? r.llm.name : "—";
        const diff = reg !== llm ? " (DIFF)" : "";
        console.log(`regex=${reg}  |  llm=${llm}${diff}`);
      }
    } catch (e) {
      console.log(`CRASH: ${e.message}`);
      results.push({ url, crash: e.message });
    }
  }

  // Summary
  const valid = results.filter((r) => !r.error && !r.crash);
  const regexHits = valid.filter((r) => r.regex);
  const llmHits = valid.filter((r) => r.llm);
  const bothAgree = valid.filter(
    (r) => (r.regex?.name || null) === (r.llm?.name || null) && r.regex
  );
  const llmOnly = valid.filter((r) => r.llm && !r.regex);
  const regexOnly = valid.filter((r) => r.regex && !r.llm);
  const bothDisagree = valid.filter(
    (r) => r.regex && r.llm && r.regex.name !== r.llm.name
  );

  console.log();
  console.log("=== SUMMARY ===");
  console.log(`valid fetches: ${valid.length}/${results.length}`);
  console.log(`  regex hits:      ${regexHits.length}`);
  console.log(`  llm hits:        ${llmHits.length}`);
  console.log(`  both agree:      ${bothAgree.length}`);
  console.log(`  llm-only (new):  ${llmOnly.length}`);
  console.log(`  regex-only:      ${regexOnly.length}`);
  console.log(`  disagree:        ${bothDisagree.length}`);

  // Write detail JSON for ground-truth labeling.
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = path.join(outDir, `agency-validate-${stamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ results, summary: { valid: valid.length, regexHits: regexHits.length, llmHits: llmHits.length, bothAgree: bothAgree.length, llmOnly: llmOnly.length, regexOnly: regexOnly.length, bothDisagree: bothDisagree.length } }, null, 2));
  console.log(`\nwrote ${outFile}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
