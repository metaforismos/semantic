# PRD: Concierge Quality Eval

**Product:** myHotel Labs > Concierge > Quality Eval
**Author:** Andres (Product Owner)
**Version:** 1.0
**Date:** 2026-03-28
**Status:** Draft

---

## 1. Problem

The Product Owner lacks a systematic tool to evaluate the conversational quality of the Concierge multi-agent pipeline. Today analysis is manual: read conversations one by one, infer which worker failed, and edit prompts blindly. This does not scale when there are hundreds of conversations and 10 active workers with multiple versions.

Specific problems:
- There is no way to measure quality beyond the derivation rate (which is operational, not qualitative).
- A conversational problem cannot be attributed to a specific worker in the pipeline.
- Changes to prompts are made without quantitative evidence of their impact.
- There is no systematic detection of continuity breaks, false agency, or hallucinations.

## 2. Objective

Internal tool for the PO that, from conversation CSVs + pipeline prompt CSVs, generates:

1. **Quantitative quality metrics** across 7 dimensions.
2. **Attribution of problems** to specific workers in the pipeline.
3. **Concrete change proposals** to prompts with justification based on real conversations.

Unlike the Pilot Report (which sells to the hotel), this tool is critical and honest. There is no positive framing.

## 3. Primary User

**Product Owner of Concierge** (Andres). Internal tool, not for CSMs or hotels.

## 4. Location in the UI

`myHotel-Labs > Concierge > Quality Eval`

## 5. Inputs

### 5.1 Conversations CSV

Same format as the Pilot Report (see PRD-Concierge-Pilot-Reporte.md, section 5.1). Reuses `csv-parser.ts`.

Key difference: **accepts multiple hotels** (multiple `customer_id` in the same CSV). The Pilot Report blocks this; Quality Eval allows it for cross-hotel analysis.

### 5.2 Pipeline Prompts CSV

Exported from the platform. Schema:

| Field | Type | Use |
|---|---|---|
| `PromptKey` | string | Identifier of the worker (INTENT_CLASSIFIER, QA_WORKER, SYNTHESIZER, etc.) |
| `Version` | semver | Version of the prompt |
| `Status` | string | "Active" or "Inactive" |
| `System_Template` | text | System prompt of the worker |
| `User_Template` | text | User message template with variables (${user_message}, ${context}, etc.) |
| `System_Size` | int | Characters of the system prompt |
| `User_Size` | int | Characters of the user template |
| `Created_At` | datetime | Date of creation |
| `Updated_At` | datetime | Last modification |

The system automatically filters only prompts with Status "Active" for the analysis. Inactive ones are retained for version comparison.

### 5.3 Metadata (form in UI)

- Evaluation period (auto-suggested from CSV, editable).
- PO notes (optional).

## 6. Concierge Multi-Agent Pipeline (Context)

The evaluator needs to understand the architecture to attribute problems. The current pipeline:

```
Guest message
    |
    v
INTENT_CLASSIFIER --> classifies intent
    |
    |---> KNOWLEDGE_QA    --> QUERY_REWRITER --> RAG --> QA_WORKER
    |---> SMALLTALK       --> SMALLTALK_WORKER
    |---> TOURISM_INFO    --> TOUR_GUIDE (web search)
    |---> SERVICE_REQUEST --> SERVICE_REQUEST_WORKER
    |---> UNKNOWN/BLOCKED --> direct response
    |---> (ambiguous)     --> INQUIRER (clarifying question)
    |
    v
SYNTHESIZER --> polishes the worker's response
    |
    v
AUDITOR --> safety gate (approve/revise/block)
    |
    v
Final response to guest
```

Parallel workers: SURVEY_WINDOW_WORKER (operates independently when there is an active survey).

## 7. The 7 Dimensions of Quality

### 7.1 Hallucination Rate

The agent asserts something that is not supported by the context (hotel KB). Since the evaluator does not have access to the real KB, hallucination is inferred when:
- The agent provides very specific data (prices, hours, phone numbers) that do not appear in the visible context of the conversation.
- The agent fabricates a complete address from just the city name.
- The agent invents services or capabilities of the hotel.

**Typical responsible worker:** QA_WORKER (generates the false data) or SYNTHESIZER (embellishes and amplifies it).

### 7.2 False Agency Rate

The agent promises or implies actions it cannot execute. Detected when:
- Uses phrases like "I have registered", "I have booked", "I will coordinate", "I will send".
- Implies operational capability: "your order will arrive shortly".
- Generates expectations of action that only a human can fulfill.

**Typical responsible worker:** SYNTHESIZER (reintroduces false agency when polishing) or QA_WORKER (generates the promise in the draft). Note: QA_WORKER v1.0.2 already has explicit rule against this ("NEVER say I will help/arrange/send") but SYNTHESIZER v1.0.1 does not.

### 7.3 Avoidable Derivation Rate

The agent directs the guest to reception when it could have resolved directly. Classifications:
- **Necessary derivation:** The agent cannot resolve (physical action, data unavailable, out of scope).
- **Derivation avoidable by KB:** The data could be in the KB but is not. Hotel's responsibility.
- **Derivation avoidable by prompt:** The prompt is too conservative or does not instruct the worker to resolve.
- **Derivation avoidable by architecture:** The pipeline does not pass enough context to the worker.

**Typical responsible worker:** QA_WORKER (not found in RAG), SERVICE_REQUEST_WORKER (by design derives everything), INTENT_CLASSIFIER (misrouting).

### 7.4 Resolution Rate

Percentage of conversations where the guest obtains a useful and complete response. Measured by:
- The guest thanks or shows satisfaction.
- Does not repeat the same question rephrased.
- Does not abandon the conversation after an unsatisfactory response.

**Typical responsible worker:** Depends on the intent — QA_WORKER, TOUR_GUIDE, or SERVICE_REQUEST_WORKER.

### 7.5 Tone Quality Score

Evaluates whether the tone is natural, appropriate, and consistent. Problems detected:
- Robotic or overly formal tone.
- Excessively long response to a simple question.
- Inappropriate use of emojis.
- Personality inconsistency between messages in the same thread.
- Failure to adapt to the guest's register (formal vs casual).

**Typical responsible worker:** SYNTHESIZER (defines final tone), SMALLTALK_WORKER (for greetings).

### 7.6 Language Match Rate

The agent responds in the guest's language. Problems:
- Guest writes in Portuguese, agent responds in Spanish.
- Mix of languages within the same response.
- Failure to detect language when it is not obvious.

**Typical responsible worker:** All workers have instruction to mirror language, but SYNTHESIZER is the one that defines the final language.

### 7.7 Continuity Rate

Coherence and context retention throughout a multi-turn conversation. Problems detected:
- Agent ignores context from previous messages.
- Agent repeats information already provided.
- Agent responds as if it were the first message ("Hello! How can I help?" on message 5).
- Agent does not connect a confirmation ("yes, please") with what it proposed.
- Agent repeats the same solution that the guest already said did not work.
- Abrupt change of tone or personality between turns.

**Typical responsible worker:** INTENT_CLASSIFIER (re-classifies each message without sufficient history), QA_WORKER/SYNTHESIZER (do not receive or do not use conversation_history).

**Architectural note:** INTENT_CLASSIFIER v1.0.4 receives `${conversation_history}`, but QA_WORKER only receives `${context}` (RAG) and `${user_message}`. If QA_WORKER does not have history, breaks are an architecture problem, not a prompt one.

## 8. Processing

### 8.1 Parsing

1. Parse conversations CSV with `csv-parser.ts` (extend to accept multi-hotel).
2. Parse prompts CSV: new `prompt-parser.ts`. Extracts active workers with their system/user templates.
3. Reconstructs conversations grouped by `conversation_id`.

### 8.2 LLM Analysis (per conversation)

Each reconstructed conversation + the pipeline's active prompts is sent to Claude (Sonnet). The LLM evaluates the 7 dimensions and produces structured JSON per conversation.

**Evaluation prompt (system):**

The system prompt includes:
- The 10 active prompts of the pipeline with their PromptKey and System_Template.
- The 7 dimensions with definitions, examples, and severity scales.
- Instruction to attribute each problem to the responsible worker.

**Evaluation prompt (user):**

The complete reconstructed conversation (all messages with type, order, and text).

**Output per conversation:**

```json
{
  "conversation_id": "conv002",
  "customer_id": 684,
  "overall_quality_score": 2.5,
  "dimensions": {
    "hallucination": {
      "score": 5,
      "issues": []
    },
    "false_agency": {
      "score": 1,
      "issues": [
        {
          "message_order": 5,
          "text_fragment": "I have registered your transfer request",
          "severity": "high",
          "responsible_worker": "SYNTHESIZER",
          "explanation": "QA_WORKER draft did not promise action, but SYNTHESIZER rewrote with false agency"
        }
      ]
    },
    "avoidable_derivation": {
      "score": 4,
      "issues": []
    },
    "resolution": {
      "score": 2,
      "issues": [
        {
          "message_order": 5,
          "severity": "high",
          "responsible_worker": "QA_WORKER",
          "explanation": "Repeats the same solution (extension 9) that the guest already said does not work"
        }
      ]
    },
    "tone": {
      "score": 4,
      "issues": []
    },
    "language_match": {
      "score": 5,
      "issues": []
    },
    "continuity": {
      "score": 1,
      "issues": [
        {
          "message_orders": [3, 5],
          "severity": "critical",
          "responsible_worker": "QA_WORKER",
          "explanation": "Guest says 'I already tried that and it does not work'. Agent repeats the exact same solution without escalating."
        }
      ]
    }
  }
}
```

**Scoring:** Each dimension from 1 (critical) to 5 (excellent). The `overall_quality_score` is the weighted average (configurable weights).

**Batching:** ~10 conversations per batch (fewer than Pilot Report because the prompt is heavier with the 10 system prompts included).

### 8.3 Aggregation

Across all analyzed conversations:

| Metric | Calculation |
|---|---|
| Hallucination Rate | % of conversations with at least 1 hallucination issue |
| False Agency Rate | % of AI messages with false agency |
| Avoidable Derivation Rate | % of derivations classified as avoidable |
| Resolution Rate | % of conversations with score >= 4 |
| Tone Quality Avg | Average of tone score |
| Language Match Rate | % of conversations with score = 5 |
| Continuity Rate | % of conversations without continuity breaks |
| Overall Quality Score | Weighted average of the 7 dimensions |

Additional aggregations:
- **Per worker:** Ranking of workers by number of issues attributed.
- **Per hotel** (if multi-hotel): Quality comparison between hotels.
- **Per dimension:** Distribution of scores by dimension.
- **Issue heatmap:** Worker x Dimension with issue count.

### 8.4 Proposal Generation

A second LLM step takes:
- The aggregated metrics.
- Top issues per worker (with example conversations).
- Active prompts of the involved workers.

And generates concrete proposals:

```json
{
  "proposals": [
    {
      "target_worker": "SYNTHESIZER",
      "target_version": "1.0.1",
      "priority": "critical",
      "category": "false_agency",
      "problem": "SYNTHESIZER has no restriction against false agency. QA_WORKER v1.0.2 says 'NEVER say I will help/arrange/send' but SYNTHESIZER can reintroduce these phrases when polishing.",
      "evidence": ["conv003", "conv004", "conv008"],
      "proposed_change": {
        "type": "add_rule",
        "location": "STRICT RULES section",
        "text": "- NEVER introduce action verbs that imply execution capability (registered, booked, arranged, sent, coordinated). If the draft uses neutral language, preserve it. Do NOT upgrade informational statements into action confirmations."
      }
    },
    {
      "target_worker": "QA_WORKER",
      "target_version": "1.0.2",
      "priority": "high",
      "category": "continuity",
      "problem": "QA_WORKER does not receive conversation_history. When the guest says 'I already tried that', the worker does not have context to generate a different response.",
      "evidence": ["conv002"],
      "proposed_change": {
        "type": "architecture",
        "description": "Pass ${conversation_history} to the QA_WORKER user template, same as is done with INTENT_CLASSIFIER."
      }
    }
  ]
}
```

Types of proposal:
- `add_rule`: Add rule to existing prompt.
- `modify_rule`: Change existing rule.
- `remove_rule`: Remove counterproductive rule.
- `architecture`: Change to the pipeline (not prompt). Ex: pass additional variables to a worker.
- `new_version`: Proposal for a complete rewritten version of the prompt.

## 9. Output

### 9.1 Interactive Dashboard (UI)

Page `/concierge/quality-eval` with:

1. **Summary cards** — The 7 dimensions with score and traffic light (red/yellow/green).
2. **Worker attribution table** — Ranking of workers by total issues, with drill-down.
3. **Issue explorer** — Filterable list of issues with expandable source conversation.
4. **Proposals panel** — Proposals ordered by priority with diff of the suggested prompt.
5. **Temporal comparison** — If multiple CSVs from different periods are loaded, evolution chart.

### 9.2 Structured JSON

Complete export with metrics, issues, and proposals for programmatic use.

### 9.3 Prompt diff export

For each accepted proposal, generates copy-pasteable text with the modified prompt ready to upload to the platform.

## 10. PO Workflow

```
1. PO navigates to myHotel-Labs > Concierge > Quality Eval
2. Loads conversations CSV (one or more hotels)
3. Loads pipeline prompts CSV
4. System validates both CSVs
5. System processes (progress bar):
   a. Parse and conversation reconstruction
   b. Parse prompts (filters active)
   c. LLM analysis per dimension (batches)
   d. Metrics aggregation
   e. Proposal generation (second LLM step)
6. PO reviews metrics dashboard
7. PO explores issues with drill-down to conversations
8. PO reviews proposals for prompt changes
9. PO exports proposals as prompt diffs
10. PO applies changes in the platform
11. Next cycle: load new CSV to measure impact
```

## 11. Technical Considerations

- **LLM:** Claude Sonnet. Temperature 0. Versioned prompt.
- **Estimated cost:** ~$0.05-0.10 per conversation (pipeline prompts included in each batch increase tokens). For 300 conversations: ~$15-30 USD. Proposal step: ~$2-5 USD additional.
- **Reuse:** `csv-parser.ts` (extend for multi-hotel), types from `types.ts`, existing chart components.
- **New code:** `prompt-parser.ts`, `quality-analyzer.ts`, `quality-types.ts`, `quality-prompts.ts`, `quality-aggregator.ts`, API routes, page and UI components.
- **No persistence in v1.** Export JSON as backup.

## 12. Validations

| Validation | Behavior |
|---|---|
| Conversations CSV: same rules as Pilot Report | Error/warning per existing PRD |
| Conversations CSV: multi-hotel allowed | OK (unlike Pilot Report) |
| Prompts CSV: required fields (PromptKey, Version, Status, System_Template) | Blocking error if missing |
| Prompts CSV: at least 1 active prompt | Blocking error |
| Minimum 10 active conversations | Blocking error |

## 13. Out of Scope (v1)

- Real-time evaluation (streaming conversations).
- Automated A/B testing of prompts.
- Direct integration with platform to apply prompt changes.
- Latency analysis per worker.
- Evaluation of the hotel's KB (knowledge base).

## 14. Roadmap

| Phase | Scope |
|---|---|
| **v1.0** | Dual CSV > 7 dimensions analysis > dashboard > proposals. Export only. |
| **v1.1** | Persistence of evaluations. Temporal comparison between evaluations. |
| **v2.0** | Direct database read (no CSV). Regression testing: when changing a prompt, automatically re-evaluate problematic conversations. |
| **v2.1** | Platform integration to apply prompt changes from the UI. |
