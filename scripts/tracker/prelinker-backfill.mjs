#!/usr/bin/env node
// Back-propagate the vendor prelinker over previously LLM-classified
// rows in tracker_resources. When a domain matches a prelinker entry
// AND its existing LLM classification disagrees with it, we overwrite
// with the canonical vendor name/product/role and re-tag the row as
// classified_by='rule'. Reruns are idempotent.
//
// Net effect:
//   - Naming consistency: "google inc" → "Google", variants → canonical
//   - Provenance: rows that could have been caught deterministically now
//     reflect that in classified_by.
//   - No LLM calls.

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

const { prelinkDomain } = await import(
  "../../src/lib/tracker/vendor-prelinker.ts"
);

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL required");
  process.exit(2);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("railway.internal")
    ? false
    : { rejectUnauthorized: false },
});
await client.connect();

// Pull every classified domain we have. Cheap — the catalog is ~2k rows.
const rows = await client.query(
  `SELECT registrable_domain, primary_role, vendor_name, vendor_product, classified_by
   FROM tracker_resources
   WHERE registrable_domain IS NOT NULL`
);

let scanned = 0;
let matchedAny = 0;
let overwrote = 0;
let alreadyMatching = 0;

for (const r of rows.rows) {
  scanned++;
  const p = prelinkDomain(r.registrable_domain);
  if (!p) continue;
  matchedAny++;
  // Does the existing classification already match the prelinker's?
  const sameVendor =
    (r.vendor_name ?? "").toLowerCase() === (p.vendor_name ?? "").toLowerCase();
  const sameRole = r.primary_role === p.role;
  const alreadyRule = r.classified_by === "rule";
  if (sameVendor && sameRole && alreadyRule) {
    alreadyMatching++;
    continue;
  }
  await client.query(
    `UPDATE tracker_resources
     SET primary_role = $2,
         vendor_name = $3,
         vendor_product = COALESCE($4::text, vendor_product),
         classified_by = 'rule',
         classified_at = NOW(),
         classification_notes = $5::text
     WHERE registrable_domain = $1`,
    [
      r.registrable_domain,
      p.role,
      p.vendor_name,
      p.vendor_product,
      `Backfilled via prelinker "${p.entry_id}" (confidence=${p.confidence.toFixed(2)})`,
    ]
  );
  overwrote++;
}

console.log(`[prelinker-backfill] scanned=${scanned}`);
console.log(`  prelinker matched:    ${matchedAny}`);
console.log(`  already matching:     ${alreadyMatching}`);
console.log(`  overwritten to 'rule': ${overwrote}`);

await client.end();
