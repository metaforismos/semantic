# Semantic Analysis Engine — Claude Code Skill

## Project Context

This is a hotel guest review semantic analysis tool for myHotel. It extracts structured opinion intelligence from reviews using a three-axis model: Area (where) × Dimension (what's being judged) × Sentiment (polarity + intensity).

## Tech Stack

- **Frontend**: Next.js 14+ (App Router) with TypeScript
- **Styling**: Tailwind CSS
- **API**: Anthropic Messages API (direct client-side calls for MVP)
  - Extraction: `claude-haiku-4-5-20251001`
  - Proposals: `claude-sonnet-4-20250514`
- **State**: React state (useState/useReducer) — no external DB for MVP
- **Data**: Static JSON pool loaded at build time

## Key Files

- `docs/PRD.md` — Full product requirements
- `data/subtopics_pool.json` — 741 curated subtopics with area, dimension, default_polarity
- `data/sample_reviews.json` — 10 test reviews in EN, ES, PT, FR, DE

## Architecture Rules

1. **Never pre-translate reviews.** The LLM processes in the original language and outputs English canonical subtopics.
2. **Three-tier extraction cascade**: subtopic (confidence ≥0.8) → topic+dimension (0.5–0.79) → area only (<0.5). The subtopic field is nullable.
3. **The pool is the source of truth.** Send the full 741-item pool as system context in every extraction call (~15K tokens). The LLM must match against this list, not invent subtopics freely.
4. **Confidence scores are mandatory** on every mention output. They drive the cascade fallback and are displayed in the UI.
5. **Polarity is ALWAYS determined by review context**, never by the subtopic's default_polarity. The default_polarity field is a hint, not a rule.
6. **Intensity is a separate field** from polarity: mild/moderate/strong. It must be calibrated per the examples in the PRD.

## Prompt Engineering Notes

- The extraction prompt is the core IP. It must include: the full pool, cascade rules, intensity calibration examples, anti-hallucination instructions ("do not invent subtopics"), and context-dependent polarity examples.
- Structure the LLM output as JSON. Use a system prompt that enforces JSON-only responses.
- For new subtopic proposals, use a separate Sonnet 4 call that validates the proposal against existing pool entries.

## Design Direction

Editorial / data-journalism aesthetic. Dark mode default. Typography-driven, information-dense. Think: The Pudding meets Bloomberg data stories. Sentiment uses red-to-green color spectrum, not emoji. Area and Dimension pills use consistent color coding. The Area × Dimension matrix heatmap is the hero visualization.

## Anti-Patterns to Avoid

- Do NOT use localStorage/sessionStorage in artifacts — use React state
- Do NOT hardcode subtopic-to-polarity mappings — sentiment is always contextual
- Do NOT translate reviews before extraction — process in original language
- Do NOT calculate semantic indices on subtopics with fewer than 10 mentions — flag as low-confidence
- Do NOT send the pool as a user message — send as system prompt to avoid per-call token bloat
