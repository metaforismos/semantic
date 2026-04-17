# myHotel Labs

Internal AI tools lab for myHotel, a CX SaaS for hotels. Prototypes and internal utilities built for the product and operations team.

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS v4 (editorial / Bloomberg aesthetic)
- **AI**: Anthropic SDK (`claude-haiku-4-5` extraction, `claude-sonnet-4` proposals), Google GenAI (`gemini-2.5-flash` + `gemini-2.5-pro` for Tracker), OpenAI SDK (fallback)
- **Database**: PostgreSQL via `pg` client (pool max=10, canonical dedup on `website_url_canonical` + `external_id`)
- **HTTP**: Node fetch + `undici` Agent fallback for insecure TLS (hotel sites with broken cert chains)
- **URL / domains**: `psl` (Public Suffix List) for registrable domain extraction in LatAm TLDs
- **PDF**: `@react-pdf/renderer` for export

## Commands

```bash
npm run dev      # Dev server on port 3000
npm run build    # Production build
npm run start    # Start production server

# Tracker maintenance scripts
node scripts/tracker/apply-migration.mjs migrations/<file>.sql    # Apply a SQL migration
node scripts/tracker/import-seed.mjs [--sample-per-country=30] [--reset]  # Seed hoteles.csv
node scripts/tracker/analyze-seed-urls.mjs                        # Count analyzable URLs in seed
node scripts/tracker/check.mjs                                    # Sanity check DB state
```

## Source Layout

```
src/
  app/              # Next.js pages + API routes
    api/            # JSON API endpoints (analyze, concierge, learning, labs, pool, tracker, validate)
    concierge/      # Concierge tool pages (meta-id, pilot-report)
    learning/       # Learning pages (skills, trivia)
    tracker/        # Tracker pages (search, bulk, browse, resources, stats)
    explorer/       # Subtopic explorer
    prompts/        # Prompt playground
    proposals/      # Subtopic proposals viewer
  components/       # React components (top-level + concierge/ + learning/ + tracker/)
  lib/              # Shared logic (top-level + concierge/ + learning/ + tracker/)
data/               # Static JSON/CSV (subtopics pool, sample reviews, questions, team,
                    # tracker/rules/* for hotel tech detection)
migrations/         # Versioned SQL migrations (apply via scripts/tracker/apply-migration.mjs)
scripts/            # Node scripts: tracker/import-seed.mjs, tracker/analyze-seed-urls.mjs, etc.
docs/               # PRDs, taxonomy, prompts, and Claude feature docs
```

## Feature Modules

Each module has a dedicated Claude doc with architecture rules, key files, and anti-patterns:

- **Semantic Analysis Engine** — Three-axis review extraction (Area x Dimension x Sentiment) with 741-subtopic taxonomy. See [`docs/claude/semantic-analysis.md`](docs/claude/semantic-analysis.md)
- **Concierge Tools** — Meta Business ID verifier, pilot report generator, and conversation quality evaluator for AI hotel concierge. See [`docs/claude/concierge.md`](docs/claude/concierge.md)
- **Learning & Trivia** — Gamified product knowledge training with roulette, quiz, leaderboard, and skill radar. See [`docs/claude/learning-trivia.md`](docs/claude/learning-trivia.md)
- **Tracker** — Base viva de hoteles LatAm+USA. Detecta stack tecnológico (booking engine, CMS, PMS, chat, analytics, reviews, ads, agencia web) desde la URL, identifica cadenas vs independientes, y sostiene un catálogo global consultable por vendor / zona geográfica. Pipeline discovery-first con fallback a LLM para dominios desconocidos. See [`docs/claude/tracker.md`](docs/claude/tracker.md)

## Global Conventions

- Editorial / data-journalism aesthetic (The Pudding meets Bloomberg). Dense Bloomberg-style tables, narrow type scale, color tokens from `globals.css`.
- All styling via Tailwind CSS utility classes. No CSS modules or styled-components.
- API routes return JSON. Use `route.ts` files under `src/app/api/`.
- Do not use localStorage for application state — use React state or API-backed persistence.
- Never pre-translate reviews (Semantic). LLM processes in original language, outputs English canonical terms.
- LLM calls happen **outside the hot path** in Tracker (post-batch classification of unique domains, not per-hotel).
- DB schema evolves via versioned SQL in `migrations/<date>-<name>.sql`. Apply with `apply-migration.mjs`. Prefer `CREATE … IF NOT EXISTS` and `ALTER TABLE … ADD COLUMN IF NOT EXISTS` so re-runs are safe.
- All data writes in Tracker go through `resolveHotel()` in `src/lib/tracker/analyze.ts` to enforce the hotel-identifier cascade (external_id → website_url_canonical → tracker_hotel_urls → create).

## Reference Docs

- `docs/PRD.md` — Semantic Analysis Engine product requirements
- `docs/TAXONOMY.md` — Full area/dimension taxonomy reference
- `docs/PROMPTS.md` — LLM prompt templates and output schemas
- `docs/PRD-Learning-Trivia.md` — Learning trivia product requirements
- `docs/PRD-Concierge-Pilot-Reporte.md` — Concierge pilot report requirements
- `docs/PRD-Concierge-Quality-Eval.md` — Concierge conversation quality evaluator requirements
- `docs/PRD-meta-business-id-verifier.md` — Meta Business ID verifier requirements
- `docs/PRD-Tracker.md` — Tracker product requirements (hotel database + tech stack discovery)
