// Concierge Quality Eval types

export const QUALITY_DIMENSIONS = [
  "hallucination",
  "false_agency",
  "avoidable_derivation",
  "resolution",
  "tone",
  "language_match",
  "continuity",
] as const;

export type QualityDimension = (typeof QUALITY_DIMENSIONS)[number];

export const DIMENSION_LABELS: Record<QualityDimension, string> = {
  hallucination: "Hallucination",
  false_agency: "False Agency",
  avoidable_derivation: "Avoidable Derivation",
  resolution: "Resolution",
  tone: "Tone Quality",
  language_match: "Language Match",
  continuity: "Continuity",
};

export const DIMENSION_DESCRIPTIONS: Record<QualityDimension, string> = {
  hallucination: "Agent asserts something not supported by context (prices, hours, services not in KB)",
  false_agency: "Agent promises or implies actions it cannot execute (booked, registered, will send)",
  avoidable_derivation: "Agent directs guest to reception when it could have resolved directly",
  resolution: "Guest obtains a useful and complete response",
  tone: "Tone is natural, appropriate, and consistent",
  language_match: "Agent responds in the guest's language",
  continuity: "Coherence and context retention throughout multi-turn conversation",
};

export const PIPELINE_WORKERS = [
  "INTENT_CLASSIFIER",
  "QUERY_REWRITER",
  "INQUIRER",
  "QA_WORKER",
  "SERVICE_REQUEST_WORKER",
  "SMALLTALK_WORKER",
  "TOUR_GUIDE",
  "SYNTHESIZER",
  "AUDITOR",
  "SURVEY_WINDOW_WORKER",
] as const;

export type PipelineWorker = (typeof PIPELINE_WORKERS)[number];

// Pipeline prompt from CSV
export interface PipelinePrompt {
  prompt_key: string;
  version: string;
  status: "Active" | "Inactive";
  system_template: string;
  user_template: string;
  system_size: number;
  user_size: number;
  created_at: string;
  updated_at: string;
}

export interface PromptParseResult {
  prompts: PipelinePrompt[];
  active_prompts: PipelinePrompt[];
  warnings: string[];
}

export interface PromptValidationError {
  type: "blocking" | "warning";
  message: string;
}

// LLM analysis output per conversation
export interface QualityIssue {
  message_order?: number;
  message_orders?: number[];
  text_fragment?: string;
  severity: "low" | "medium" | "high" | "critical";
  responsible_worker: string;
  explanation: string;
}

export interface DimensionScore {
  score: number; // 1-5
  issues: QualityIssue[];
}

export interface ConversationQualityAnalysis {
  conversation_id: string;
  customer_id: number;
  overall_quality_score: number;
  dimensions: Record<QualityDimension, DimensionScore>;
}

// Proposal types
export type ProposalType = "add_rule" | "modify_rule" | "remove_rule" | "architecture" | "new_version";

export interface ProposalChange {
  type: ProposalType;
  location?: string;
  text?: string;
  description?: string;
}

export interface QualityProposal {
  target_worker: string;
  target_version: string;
  priority: "critical" | "high" | "medium" | "low";
  category: QualityDimension;
  problem: string;
  evidence: string[]; // conversation_ids
  proposed_change: ProposalChange;
}

// Aggregated metrics
export interface DimensionAggregate {
  dimension: QualityDimension;
  avg_score: number;
  rate: number; // % of conversations with issues (score < 5) or resolution rate (score >= 4)
  total_issues: number;
  severity_distribution: Record<string, number>;
}

export interface WorkerAttribution {
  worker: string;
  total_issues: number;
  by_dimension: Record<string, number>;
  top_issues: QualityIssue[];
}

export interface HotelBreakdown {
  customer_id: number;
  conversation_count: number;
  avg_quality_score: number;
  dimension_scores: Record<QualityDimension, number>;
}

export interface QualityEvalReport {
  meta: {
    period_start: string;
    period_end: string;
    generated_at: string;
    report_version: string;
    total_conversations: number;
    hotel_count: number;
    notes: string;
  };
  overall_quality_score: number;
  dimensions: DimensionAggregate[];
  worker_attributions: WorkerAttribution[];
  hotel_breakdowns: HotelBreakdown[];
  issue_heatmap: Record<string, Record<string, number>>; // worker -> dimension -> count
  proposals: QualityProposal[];
  conversation_analyses: ConversationQualityAnalysis[];
}

export interface QualityUploadFormData {
  period_start: string;
  period_end: string;
  notes: string;
}

export interface QualityAnalysisProgress {
  stage: "parsing" | "analyzing" | "proposing" | "aggregating" | "done" | "error";
  current_batch: number;
  total_batches: number;
  message: string;
}
