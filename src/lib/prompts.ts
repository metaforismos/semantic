import { Subtopic } from "./types";

// ── Default instruction templates (editable by the user in /prompts) ──

export const DEFAULT_EXTRACTION_INSTRUCTIONS = `## Extraction Rules

### Three-Tier Cascade
For each opinion unit detected:

**Tier 1 — Subtopic match (confidence ≥ 0.8)**
If you can confidently map the opinion to a specific pool subtopic:
- Set subtopic to the matched pool entry
- Set area, dimension from the pool entry
- Determine polarity and intensity from review context (NOT from default_polarity)

**Tier 2 — Topic + Dimension (confidence 0.5–0.79)**
If specific enough for topic and dimension but NOT for a subtopic:
- Set subtopic to null
- Set topic to the identified subject (e.g., "Pool", "Breakfast", "Staff")
- Set area and dimension based on your judgment

**Tier 3 — Area only (confidence < 0.5)**
If too vague for topic-level:
- Set subtopic to null, topic to null
- Set area based on best guess, dimension to null

### Anti-Hallucination Rules
- "the food was bad" with NO qualifier → topic="Food", area="F&B", dimension="Food Quality", polarity="negative", subtopic=null
- "great hotel" with no specifics → area="General Experience", polarity="positive", subtopic=null
- Only assign subtopic when the review contains a SPECIFIC qualifier mapping to a pool entry.

### Polarity — ALWAYS Contextual
Determine polarity from review text, NOT default_polarity:
- "Finally a hot shower!" → hot-shower, POSITIVE
- "The shower was scalding hot" → hot-shower, NEGATIVE

### Intensity Calibration
- mild: "a bit small", "could have been better"
- moderate: "too small for our luggage", "really bad"
- strong: "Impossibly tiny!", "worst I've ever had"

### Language
- Process in ORIGINAL language, extract original_text in source language
- Map to English canonical subtopics
- Set source_language to ISO 639-1 code

### New Subtopic Proposals
If a clear opinion does NOT match any pool subtopic:
- Set subtopic to null
- Set proposed_subtopic to a new adjective-noun form in English
- Set proposed_area and proposed_dimension
- Only for genuinely novel concepts

## Output — JSON ONLY, no preamble, no markdown fences
{
  "source_language": "xx",
  "mentions": [
    {
      "original_text": "...",
      "subtopic": "matched-subtopic" or null,
      "topic": "Topic" or null,
      "area": "Area Name",
      "dimension": "Dimension Name" or null,
      "polarity": "positive"|"negative"|"neutral",
      "intensity": "mild"|"moderate"|"strong",
      "confidence": 0.0-1.0,
      "extraction_tier": "subtopic"|"topic"|"area",
      "proposed_subtopic": null or "new-subtopic",
      "proposed_area": null or "Area",
      "proposed_dimension": null or "Dimension"
    }
  ]
}`;

export const DEFAULT_VALIDATION_INSTRUCTIONS = `## Validation Checks
1. Is this genuinely new, or a synonym/variant of an existing subtopic?
2. Does it follow the adjective-noun canonical form?
3. Is the area assignment correct?
4. Is the dimension assignment correct?
5. What are the 3 closest existing subtopics?

## Output — JSON ONLY, no preamble, no markdown fences
{
  "is_valid": true/false,
  "reason": "...",
  "recommended_subtopic": "adjective-noun",
  "recommended_area": "Area",
  "recommended_dimension": "Dimension",
  "recommended_default_polarity": "positive"|"negative"|"context-dependent",
  "closest_existing": [
    {"subtopic": "...", "similarity": "..."}
  ],
  "merge_suggestion": null or "existing-subtopic"
}`;

// ── Prompt builders (accept optional instruction overrides) ──

export function buildExtractionSystemPrompt(pool: Subtopic[], customInstructions?: string): string {
  const poolCompact = pool.map((s) => `${s.subtopic}|${s.area}|${s.dimension}|${s.default_polarity}`).join("\n");
  const instructions = customInstructions || DEFAULT_EXTRACTION_INSTRUCTIONS;

  return `You are a hotel guest review semantic analysis engine. Extract structured opinion units ("mentions") from hotel guest reviews.

## Subtopic Pool (${pool.length} entries)
Format: subtopic|area|dimension|default_polarity
${poolCompact}

${instructions}`;
}

export function buildValidationSystemPrompt(pool: Subtopic[], customInstructions?: string): string {
  const poolCompact = pool.map((s) => `${s.subtopic}|${s.area}|${s.dimension}`).join("\n");
  const instructions = customInstructions || DEFAULT_VALIDATION_INSTRUCTIONS;

  return `You are a taxonomy validator for a hotel semantic analysis system. Validate whether a proposed subtopic should be added to the pool.

## Current Pool (${pool.length} entries)
Format: subtopic|area|dimension
${poolCompact}

${instructions}`;
}
