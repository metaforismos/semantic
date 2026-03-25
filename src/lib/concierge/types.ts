// Concierge Pilot Report types

export type MessageType = "Campaign" | "Human" | "IA" | "Survey" | "Automatic";

export interface RawMessage {
  customer_id: number;
  customer_name: string;
  conversation_id: string;
  external_line: string;
  message_type: MessageType;
  campaign: string;
  template: string;
  sent_at: string;
  message_order: number;
  conversation_text: string;
}

export interface Message {
  message_type: MessageType;
  campaign: string;
  template: string;
  sent_at: Date;
  message_order: number;
  text: string;
  external_line: string;
}

export interface Conversation {
  conversation_id: string;
  customer_id: number;
  customer_name: string;
  messages: Message[];
  origin: string; // campaign type of first Campaign/Survey message
  is_active: boolean; // has at least 1 Human message after first Campaign/Survey
  external_line: string;
}

export interface CSVParseResult {
  conversations: Conversation[];
  customer_id: number;
  customer_name: string;
  period_start: string; // ISO date
  period_end: string;
  warnings: string[];
  total_rows: number;
  discarded_rows: number;
}

export interface CSVValidationError {
  type: "blocking" | "warning";
  message: string;
}

// LLM analysis output per conversation
export interface IAMessageAnalysis {
  message_order: number;
  derived: boolean;
  derivation_reason: string;
  derivation_topic?: string;
  derivation_subtopic?: string;
}

export interface ConversationAnalysis {
  conversation_id: string;
  satisfaction_score: number; // 1-5
  satisfaction_signal: string;
  topics: string[];
  ia_messages: IAMessageAnalysis[];
  is_success_case: boolean;
  success_summary: string;
}

// Aggregated metrics
export interface InteractionByOrigin {
  origin: string;
  rate: number;
  responded: number;
  contacted: number;
}

export interface DerivationReason {
  reason: string;
  count: number;
  pct: number;
}

export interface SubtopicCount {
  label: string;
  count: number;
}

export interface DerivationByTopic {
  topic: string;
  count: number;
  pct: number;
  reasons: DerivationReason[];
  subtopics: SubtopicCount[];
}

export interface TopicCount {
  topic: string;
  count: number;
  pct: number;
}

export interface SuccessCase {
  conversation_id: string;
  summary: string;
  satisfaction_score: number;
  topics: string[];
  url: string;
}

export interface ImprovementOpportunity {
  area: string;
  detail: string;
  owner: "hotel" | "myhotel";
  impact: string;
}

export interface PilotReportData {
  meta: {
    hotel_name: string;
    hotel_id: number;
    period_start: string;
    period_end: string;
    tone: "positive";
    generated_at: string;
    report_version: string;
    total_conversations: number;
    active_conversations: number;
    concierge_name: string;
    notes: string;
  };
  metrics: {
    valid_data_rate: {
      phone: number;
      note: string;
    };
    interaction_rate: {
      overall: number;
      contacted: number;
      responded: number;
    };
    interaction_by_origin: InteractionByOrigin[];
    automation_rate: {
      rate: number;
      not_derived: number;
      derived: number;
      total_ia_messages: number;
      label: string;
    };
    derivation_rate: {
      rate: number;
      top_reasons: DerivationReason[];
      by_topic: DerivationByTopic[];
    };
    time_saved: {
      hours: number;
      equivalent_manual_tasks: number;
      equivalent_task_label: string;
      human_benchmark_minutes: number;
    };
    response_time: {
      bot_median_seconds: number;
      human_benchmark_minutes: number;
    };
    inferred_satisfaction: {
      distribution: Record<string, number>;
      positive_rate: number;
      positive_label: string;
    };
    top_topics: TopicCount[];
  };
  success_cases: SuccessCase[];
  improvement_opportunities: ImprovementOpportunity[];
}

export interface UploadFormData {
  period_start: string;
  period_end: string;
  concierge_name: string;
  notes: string;
}

export interface AnalysisProgress {
  stage: "parsing" | "metrics" | "llm" | "aggregating" | "done" | "error";
  current_batch: number;
  total_batches: number;
  message: string;
}

export const CONCIERGE_TOPICS = [
  "Check-in / Check-out",
  "WiFi / Conectividad",
  "Room Service",
  "Housekeeping",
  "Reservas de restaurante",
  "Amenities (piscina, spa, gym)",
  "Reclamos / Problemas en habitación",
  "Transporte / Transfers",
  "Información turística",
  "Facturación",
  "Información de contacto",
  "Horarios",
  "Servicios del hotel",
  "Otro",
] as const;
