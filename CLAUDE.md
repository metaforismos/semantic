# myHotel Labs

Internal AI tools lab for myHotel, a CX SaaS for hotels. Prototypes and internal utilities built for the product and operations team.

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS (dark mode default)
- **AI**: Anthropic SDK (`claude-haiku-4-5` for extraction, `claude-sonnet-4` for proposals), Google GenAI, OpenAI SDK
- **Database**: PostgreSQL via `pg` client
- **PDF**: `@react-pdf/renderer` for export

## Commands

```bash
npm run dev      # Dev server on port 3000
npm run build    # Production build
npm run start    # Start production server
```

## Source Layout

```
src/
  app/              # Next.js pages + API routes
    api/            # JSON API endpoints (analyze, concierge, learning, labs, pool, validate)
    concierge/      # Concierge tool pages (meta-id, pilot-report)
    learning/       # Learning pages (skills, trivia)
    explorer/       # Subtopic explorer
    prompts/        # Prompt playground
    proposals/      # Subtopic proposals viewer
  components/       # React components (top-level + concierge/ + learning/)
  lib/              # Shared logic (top-level + concierge/ + learning/)
data/               # Static JSON/CSV (subtopics pool, sample reviews, questions, team)
docs/               # PRDs, taxonomy, prompts, and Claude feature docs
```

## Feature Modules

Each module has a dedicated Claude doc with architecture rules, key files, and anti-patterns:

- **Semantic Analysis Engine** — Three-axis review extraction (Area x Dimension x Sentiment) with 741-subtopic taxonomy. See [`docs/claude/semantic-analysis.md`](docs/claude/semantic-analysis.md)
- **Concierge Tools** — Meta Business ID verifier, pilot report generator, and conversation quality evaluator for AI hotel concierge. See [`docs/claude/concierge.md`](docs/claude/concierge.md)
- **Learning & Trivia** — Gamified product knowledge training with roulette, quiz, leaderboard, and skill radar. See [`docs/claude/learning-trivia.md`](docs/claude/learning-trivia.md)

## Global Conventions

- Dark mode is the default. Editorial / data-journalism aesthetic (The Pudding meets Bloomberg).
- All styling via Tailwind CSS utility classes. No CSS modules or styled-components.
- API routes return JSON. Use `route.ts` files under `src/app/api/`.
- Do not use localStorage for application state — use React state or API-backed persistence.
- Never pre-translate reviews. LLM processes in original language, outputs English canonical terms.

## Reference Docs

- `docs/PRD.md` — Semantic Analysis Engine product requirements
- `docs/TAXONOMY.md` — Full area/dimension taxonomy reference
- `docs/PROMPTS.md` — LLM prompt templates and output schemas
- `docs/PRD-Learning-Trivia.md` — Learning trivia product requirements
- `docs/PRD-Concierge-Pilot-Reporte.md` — Concierge pilot report requirements
- `docs/PRD-Concierge-Quality-Eval.md` — Concierge conversation quality evaluator requirements
- `docs/PRD-meta-business-id-verifier.md` — Meta Business ID verifier requirements
