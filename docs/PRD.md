# PRD: Semantic Analysis Engine — Guest Review Intelligence

## 1. Product Overview

A three-axis semantic analysis system that extracts structured opinion intelligence from hotel guest reviews. Unlike hierarchical competitors (ReviewPro ~500 concepts, TrustYou ~700 categories), this system decomposes each guest opinion into three orthogonal axes:

- **Area** (where): 23 hotel operational areas
- **Dimension** (what's being judged): 17 assessment dimensions
- **Sentiment** (how): polarity (positive/negative/neutral) + intensity (mild/moderate/strong)

Each opinion unit maps to a **subtopic** from a curated pool of 741 canonical adjective-noun pairs (e.g., `dirty-pool`, `slow-checkin`, `rude-server`), enabling cross-cutting analysis no competitor currently offers.

---

## 2. Architecture

### 2.1 System Components

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (React)                   │
│  Review Input → Results Display → Subtopic Manager  │
└─────────────┬───────────────────────────┬───────────┘
              │                           │
              ▼                           ▼
┌─────────────────────┐   ┌──────────────────────────┐
│  Extraction Engine   │   │   Subtopic Pool Manager  │
│  (LLM: Claude       │   │   (CRUD + proposals)     │
│   Haiku 3.5)        │   │                          │
└─────────┬───────────┘   └──────────────────────────┘
          │
          ▼
┌─────────────────────┐
│  Classification &    │
│  Mapping Engine      │
│  (LLM: Claude       │
│   Haiku 3.5)        │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Structured Output   │
│  (JSON mentions)     │
└─────────────────────┘
```

### 2.2 Data Flow

1. **Input**: Raw review text (any language)
2. **Language Detection**: Identify source language
3. **Extraction**: LLM extracts opinion units from raw text
4. **Normalization**: Map each opinion to English canonical subtopic form
5. **Pool Matching**: Match against the 741 subtopic pool
6. **Fallback Logic**: If no match → propose new subtopic OR fall back to topic/area
7. **Output**: Structured JSON with all axes + confidence scores

### 2.3 Three-Tier Extraction Cascade

```
TRY subtopic match (confidence ≥ 0.8)
  → "dirty-pool" | Area: Pool & Beach | Dimension: Cleanliness | Sentiment: negative/strong
  
FALLBACK TO topic + dimension (confidence 0.5–0.79)
  → Topic: "Pool" | Area: Pool & Beach | Dimension: Cleanliness | Sentiment: negative
  → Subtopic: null (insufficient specificity)
  
FALLBACK TO area only (confidence < 0.5)
  → Area: Pool & Beach | Sentiment: negative
  → Topic: null | Subtopic: null
```

---

## 3. Data Model

### 3.1 Subtopic Pool (741 entries)

```typescript
interface Subtopic {
  id: string;                    // e.g., "dirty-pool"
  subtopic: string;              // "dirty-pool" (adjective-noun canonical form)
  area: Area;                    // "Pool & Beach"
  dimension: Dimension;          // "Cleanliness"
  default_polarity: 'positive' | 'negative' | 'context-dependent';
  status: 'active' | 'proposed' | 'rejected';
  created_at: string;
  proposed_by?: 'system' | 'user';
}
```

### 3.2 Areas (23)

```
Room | Bathroom | Housekeeping | F&B | Staff | Front Desk | Facilities |
Pool & Beach | Spa & Wellness | Entertainment | Location | Value |
General Experience | Safety & Security | Noise | Maintenance | Technology |
Accessibility | Parking & Transport | Sustainability | Kids & Family |
Pet Policy | Laundry
```

### 3.3 Dimensions (17) — reduced from original 23

```
Service Quality (111) | Cleanliness (71) | Condition (67) | Availability (66) |
Aesthetics (53) | Size (50) | Food Quality (46) | Speed (43) | Value (42) |
Comfort (33) | Ambiance (31) | Temperature (30) | Convenience (28) |
Variety (26) | Noise (24) | Safety (14) | Sustainability (6)
```

**Dimension merges applied:**
- Maintenance → Condition
- Infrastructure → Condition  
- Pest Control → Cleanliness
- Smell → Cleanliness
- Communication → Service Quality
- Crowding → Comfort
- Flexibility → Convenience

### 3.4 Mention (extraction output)

```typescript
interface Mention {
  id: string;
  review_id: string;
  
  // Source text
  original_text: string;         // Verbatim snippet from review
  source_language: string;       // ISO 639-1 code (es, en, pt, etc.)
  
  // Classification
  subtopic: string | null;       // "dirty-pool" or null if fallback
  area: string;                  // Always assigned
  topic: string | null;          // Intermediate level (e.g., "Pool")
  dimension: string | null;      // "Cleanliness" or null if area-only fallback
  
  // Sentiment
  polarity: 'positive' | 'negative' | 'neutral';
  intensity: 'mild' | 'moderate' | 'strong';
  
  // Confidence
  confidence: number;            // 0.0–1.0
  extraction_tier: 'subtopic' | 'topic' | 'area';  // Which tier resolved
  
  // New subtopic proposal (when unmatched)
  proposed_subtopic?: string;    // e.g., "missing-ev-charger"
  proposed_area?: string;
  proposed_dimension?: string;
}
```

### 3.5 Review (container)

```typescript
interface ReviewAnalysis {
  id: string;
  raw_text: string;
  source_language: string;
  detected_language: string;
  mentions: Mention[];
  overall_sentiment: {
    polarity: 'positive' | 'negative' | 'neutral' | 'mixed';
    score: number;               // -1.0 to 1.0
  };
  processing_time_ms: number;
  model_used: string;
}
```

---

## 4. LLM Strategy

### 4.1 Model Selection per Task

| Task | Model | Reasoning |
|------|-------|-----------|
| Opinion unit extraction + sentiment | **Claude Haiku 3.5** (`claude-haiku-4-5-20251001`) | High throughput, low cost, sufficient accuracy for extraction. Processes ~50 reviews/second. |
| Subtopic matching against pool | **Claude Haiku 3.5** | Pattern matching against a known list — doesn't need Sonnet-level reasoning. |
| New subtopic proposal (unmatched) | **Claude Sonnet 4** (`claude-sonnet-4-20250514`) | Requires judgment about whether a new subtopic is genuinely novel vs. a variant of an existing one. Higher reasoning needed. |
| Batch reprocessing / taxonomy evolution | **Claude Sonnet 4** | Strategic decisions about pool expansion benefit from stronger reasoning. |

**Cost estimate**: At Haiku 3.5 pricing, processing 10,000 reviews ≈ $2-4 USD (assuming ~300 tokens input + 200 tokens output per review).

### 4.2 Language Handling Strategy

**Problem**: Reviews arrive in Spanish (primary for LATAM), English, Portuguese, French, German, Italian, Chinese, Japanese, Korean, and others.

**Solution**: The LLM processes in the **original language** and outputs in **English canonical form**. No pre-translation step.

```
Input (Spanish): "La piscina estaba asquerosa y el agua verde"
                              ↓
LLM extracts (in context):   opinion_1: "piscina asquerosa" → dirty-pool
                              opinion_2: "agua verde" → algae-pool
                              ↓
Output: English canonical subtopics with original_text preserved in Spanish
```

**Why this works**: Modern LLMs are natively multilingual. Translating first introduces error (especially for colloquial hotel review language). Extracting directly and mapping to English canonical form preserves the original nuance while standardizing the output.

**Prompt instruction**: "Extract opinion units from this hotel review. The review may be in any language. For each opinion unit, identify the original text in its source language, then map it to the closest English adjective-noun subtopic from the provided pool. If no match exists, propose a new English adjective-noun subtopic."

### 4.3 Extraction Prompt Design

The extraction prompt must include:

1. **The complete subtopic pool** (741 entries) as a reference list — passed as a system-level context, not per-message
2. **The three-tier fallback logic** explicitly stated
3. **Intensity calibration examples**:
   - Mild: "the room was a bit small" → intensity: mild
   - Moderate: "the room was too small for our luggage" → intensity: moderate  
   - Strong: "impossibly tiny, we couldn't even open our suitcases" → intensity: strong
4. **Anti-hallucination instruction**: "If the review says 'the food was bad' with no further detail, assign topic='Food' and area='F&B' with dimension='Food Quality' and polarity='negative'. Do NOT invent a subtopic like 'bad-food'. The subtopic field should be null when the guest provides no specific qualifier."
5. **Context-dependent polarity examples**:
   - "Finally a hot shower!" → hot-shower, positive
   - "The shower was scalding, almost burned me" → hot-shower, negative

### 4.4 Confidence Score Calibration

The LLM assigns confidence based on:

- **0.9–1.0**: Exact or near-exact match to a pool subtopic. Clear, unambiguous text.
- **0.7–0.89**: Good match but some interpretation required (e.g., slang, implied meaning).
- **0.5–0.69**: Reasonable inference but ambiguous. Falls back to topic+dimension.
- **Below 0.5**: Vague or generic comment. Falls back to area only.

**Sparsity strategy**: For properties with <500 reviews/year, aggregate to dimension level for statistical reporting. Subtopic-level detail is available for drill-down but not used for index calculations unless n≥10 mentions per subtopic.

---

## 5. Frontend Specification

### 5.1 Tech Stack

- **Framework**: React 18+ with TypeScript
- **Styling**: Tailwind CSS
- **State**: React state (useState/useReducer) — no external state management needed for MVP
- **API**: Anthropic Messages API (Claude Haiku 3.5 for extraction, Sonnet 4 for proposals)
- **Data**: In-memory subtopic pool loaded from JSON file

### 5.2 Pages / Views

#### View 1: Review Input & Analysis

**Layout**: Split-screen. Left: text input. Right: analysis results.

**Left panel**:
- Large textarea for review paste
- Language auto-detection indicator (shows detected language flag/code)
- "Analyze" button
- Sample review buttons (pre-loaded examples in EN, ES, PT, FR, DE)
- Batch mode toggle: paste multiple reviews separated by `---`

**Right panel** (after analysis):
- **Mention cards**: One card per extracted mention, showing:
  - Original text snippet (highlighted in source language)
  - Subtopic badge (or "No subtopic — topic-level only" indicator)
  - Area pill
  - Dimension pill
  - Sentiment: polarity icon + intensity bar (3 segments: mild/moderate/strong)
  - Confidence score (as percentage)
  - Extraction tier indicator (subtopic / topic / area)
- **Summary bar** at top:
  - Total mentions count
  - Polarity breakdown (positive/negative/neutral pie or bar)
  - Average confidence
  - Dimension heatmap (which dimensions appeared)

#### View 2: Subtopic Proposal Queue

When the LLM detects an opinion that doesn't match any pool subtopic, it proposes a new one. This view shows:

- **Proposed subtopic** in canonical form
- **Suggested area** and **dimension**
- **Source review snippet** that triggered it
- **Similar existing subtopics** (top 3 closest matches from pool)
- **Actions**: Approve (adds to pool) | Reject | Merge with existing

#### View 3: Pool Explorer

- Filterable table of all 741+ subtopics
- Filter by: Area, Dimension, Default Polarity, Status
- Search by subtopic name
- Area × Dimension matrix heatmap (shows count of subtopics per cell)
- Click a cell to see all subtopics in that intersection

### 5.3 Design Direction

**Aesthetic**: Editorial / data-journalism. Think: The Pudding, Bloomberg data stories. Clean, information-dense, typography-driven. Dark mode default.

**Key visual elements**:
- Sentiment uses a red-to-green color spectrum (not emoji)
- Intensity shown as a 3-segment bar (thin, medium, thick fill)
- Confidence shown as a circular progress indicator
- Area and Dimension pills use consistent color coding throughout
- Mention cards have a subtle left border colored by polarity
- The Area × Dimension matrix is the hero visualization

### 5.4 Interaction Flow

```
1. User pastes review text
2. Clicks "Analyze" 
3. Loading state shows extraction progress
4. Results populate right panel with mention cards
5. If unmatched opinions found → yellow badge "N new subtopics proposed"
6. User clicks badge → navigates to Proposal Queue
7. User approves/rejects → pool updates in real-time (in-memory)
8. User can switch to Pool Explorer to verify the pool state
```

---

## 6. Sparsity & Statistical Strategy

### 6.1 Reporting Thresholds

| Level | Minimum mentions for index | Use case |
|-------|---------------------------|----------|
| Area | n ≥ 5 | Always report |
| Dimension (cross-area) | n ≥ 10 | Cross-cutting analysis |
| Subtopic | n ≥ 10 | Drill-down only |
| Area × Dimension cell | n ≥ 5 | Matrix heatmap |

Below threshold → show data but flag as "Low confidence — insufficient data" with visual indicator.

### 6.2 Semantic Index Calculation

```
Semantic Index = (positive_mentions / total_mentions) × 100
```

Applied at every level (subtopic, topic, dimension, area). Intensity-weighted variant:

```
Weighted Index = Σ(polarity_score × intensity_weight) / Σ(intensity_weight) × 100

Where:
  polarity_score: positive = 1, neutral = 0.5, negative = 0
  intensity_weight: mild = 1, moderate = 2, strong = 3
```

### 6.3 Confidence-Weighted Aggregation

Only mentions with confidence ≥ 0.6 contribute to index calculations. Mentions below 0.6 are stored but excluded from aggregate metrics, preventing low-confidence extractions from polluting scores.

---

## 7. New Subtopic Discovery Protocol

### 7.1 When to propose

The extraction LLM proposes a new subtopic when:
1. It identifies a clear opinion unit with a specific adjective+noun structure
2. No existing pool subtopic matches with confidence ≥ 0.7
3. The proposed subtopic is not a synonym/variant of an existing one (LLM checks)

### 7.2 Proposal validation (Sonnet 4)

When a proposal is generated, a second LLM call (Sonnet 4) validates:
- Is this genuinely new or a rephrasing of an existing subtopic?
- What are the 3 closest existing subtopics? (similarity check)
- Proposed area and dimension assignment
- Expected default polarity

### 7.3 User approval flow

- Proposals queue in the frontend
- User sees: proposed subtopic, source text, similar existing, suggested classification
- Actions: Approve (adds to pool) | Reject | Merge with existing (select target)
- Approved subtopics persist in the in-memory pool for the session
- Export function to download updated pool as CSV/JSON

---

## 8. Implementation Phases

### Phase 1: Core Engine + Basic UI (MVP)
- Extraction prompt with full pool context
- Single review analysis
- Mention display with all three axes
- Confidence scores
- Polarity + intensity
- Language detection

### Phase 2: Subtopic Discovery
- New subtopic proposal mechanism
- Proposal queue UI
- Approve/reject/merge workflow
- Pool persistence (in-memory for session, export for permanence)

### Phase 3: Pool Explorer + Analytics
- Filterable subtopic table
- Area × Dimension matrix heatmap
- Batch review processing
- Summary statistics and index calculations

---

## 9. File Structure

```
semantic/
├── docs/
│   └── PRD.md                    # This document
├── data/
│   ├── subtopics_pool.json       # 741 subtopics with area, dimension, default_polarity
│   ├── subtopics_pool.csv        # Same data in CSV format
│   └── sample_reviews.json       # Test reviews in multiple languages
├── skills/
│   └── SKILL.md                  # Claude Code skill file for this project
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main review analysis view
│   │   ├── proposals/
│   │   │   └── page.tsx          # Subtopic proposal queue
│   │   └── explorer/
│   │       └── page.tsx          # Pool explorer
│   ├── components/
│   │   ├── ReviewInput.tsx       # Text input + language detection
│   │   ├── MentionCard.tsx       # Individual mention display
│   │   ├── AnalysisSummary.tsx   # Summary bar with stats
│   │   ├── ProposalCard.tsx      # New subtopic proposal card
│   │   ├── PoolTable.tsx         # Filterable subtopic table
│   │   ├── DimensionMatrix.tsx   # Area × Dimension heatmap
│   │   └── SentimentBadge.tsx    # Polarity + intensity display
│   ├── lib/
│   │   ├── extraction.ts         # LLM extraction logic
│   │   ├── pool.ts               # Subtopic pool management
│   │   ├── prompts.ts            # All LLM prompt templates
│   │   └── types.ts              # TypeScript interfaces
│   └── data/
│       └── subtopics_pool.json   # Bundled pool data
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

---

## 10. Success Criteria

1. **Coverage**: ≥85% of opinion units in test reviews match a pool subtopic with confidence ≥0.7
2. **Accuracy**: ≥90% of subtopic assignments are correct (validated by human review of 100 test cases)
3. **Polarity accuracy**: ≥95% correct polarity assignment
4. **Intensity accuracy**: ≥80% correct intensity assignment  
5. **Language support**: Correctly processes reviews in ES, EN, PT, FR, DE without quality degradation
6. **Latency**: Single review analysis completes in <3 seconds (Haiku 3.5)
7. **New subtopic detection**: System proposes relevant new subtopics for ≥50% of genuinely novel opinions

---

## 11. Open Questions / Decisions

1. **Next.js vs plain React?** — Next.js gives routing and SSR but adds complexity. For a testing tool, plain React with react-router may be simpler. **Recommendation: Next.js** for the structured file-based routing across 3 views.
2. **Pool persistence beyond session?** — MVP uses in-memory + export. Production would need a database (Supabase). **Defer to Phase 2+.**
3. **Batch API vs sequential?** — For batch processing, Claude's batch API could reduce costs by 50%. **Defer to Phase 3.**
4. **Should the pool be sent in every API call or cached?** — For Haiku, the 741-item pool fits within context (~15K tokens). Send it as system prompt per call. If pool grows beyond 1,500 items, switch to embedding-based retrieval.
