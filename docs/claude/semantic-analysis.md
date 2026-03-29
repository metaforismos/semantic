# Semantic Analysis Engine

Three-axis extraction model: **Area** (where in the hotel) x **Dimension** (what's being judged) x **Sentiment** (polarity + intensity). Extracts structured opinion intelligence from guest reviews.

## Architecture Rules

1. **Never pre-translate reviews.** The LLM processes in the original language and outputs English canonical subtopics.
2. **Three-tier extraction cascade** based on confidence:
   - `>= 0.8`: full subtopic match
   - `0.5 - 0.79`: topic + dimension only
   - `< 0.5`: area only (subtopic field is nullable)
3. **The pool is the source of truth.** Send the full 741-item pool as system context in every extraction call (~15K tokens). The LLM must match against this list, not invent subtopics.
4. **Confidence scores are mandatory** on every mention. They drive cascade fallback and UI display.
5. **Polarity is ALWAYS determined by review context**, never by `default_polarity`. The default is a hint, not a rule.
6. **Intensity is a separate field** from polarity: `mild | moderate | strong`. Calibrate per PRD examples.

## Key Files

| Purpose | Path |
|---------|------|
| Analysis API route | `src/app/api/analyze/route.ts` |
| Extraction prompts | `src/lib/prompts.ts` |
| LLM integration | `src/lib/llm.ts` |
| Subtopic pool logic | `src/lib/pool.ts` |
| Response parsing | `src/lib/parse.ts` |
| Global types | `src/lib/types.ts` |
| Pool data (741 items) | `data/subtopics_pool.json` |
| Sample reviews | `data/sample_reviews.json` |
| Analysis page | `src/app/page.tsx` |
| Explorer page | `src/app/explorer/page.tsx` |
| Proposals page | `src/app/proposals/page.tsx` |
| Prompt playground | `src/app/prompts/page.tsx` |

## UI Components

- `ReviewInput` — text input + model selector + batch support
- `MentionCard` — single extracted mention with area/dimension/sentiment
- `AnalysisSummary` — aggregate stats for a review
- `ConfidenceRing` — visual confidence indicator
- `SentimentBadge` — polarity color badge
- `Sidebar` — navigation across all modules

## Prompt Engineering Notes

- The extraction prompt is the core IP. It must include: the full pool, cascade rules, intensity calibration examples, anti-hallucination instructions ("do not invent subtopics"), and context-dependent polarity examples.
- Structure LLM output as JSON. System prompt enforces JSON-only responses.
- For new subtopic proposals, use a separate Sonnet 4 call that validates against existing pool entries.

## Design Direction

Editorial / data-journalism aesthetic. Typography-driven, information-dense. Sentiment uses red-to-green color spectrum, not emoji. Area and Dimension pills use consistent color coding. The Area x Dimension matrix heatmap is the hero visualization.

## Anti-Patterns

- Do NOT hardcode subtopic-to-polarity mappings — sentiment is always contextual
- Do NOT translate reviews before extraction — process in original language
- Do NOT calculate semantic indices on subtopics with fewer than 10 mentions — flag as low-confidence
- Do NOT send the pool as a user message — send as system prompt to avoid per-call token bloat
- Do NOT use localStorage/sessionStorage for persistent state — use React state or API

## Reference

- `docs/PRD.md` — Full product requirements
- `docs/TAXONOMY.md` — All 23 areas and 17 dimensions with definitions
- `docs/PROMPTS.md` — Prompt templates and output schemas
