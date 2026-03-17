export interface Subtopic {
  subtopic: string;
  area: string;
  dimension: string;
  default_polarity: "positive" | "negative" | "context-dependent";
  status?: "active" | "proposed" | "rejected";
}

export interface Mention {
  id: string;
  original_text: string;
  subtopic: string | null;
  topic: string | null;
  area: string;
  dimension: string | null;
  polarity: "positive" | "negative" | "neutral";
  intensity: "mild" | "moderate" | "strong";
  confidence: number;
  extraction_tier: "subtopic" | "topic" | "area";
  proposed_subtopic: string | null;
  proposed_area: string | null;
  proposed_dimension: string | null;
}

export interface ReviewAnalysis {
  id: string;
  raw_text: string;
  source_language: string;
  mentions: Mention[];
  overall_sentiment: {
    polarity: "positive" | "negative" | "neutral" | "mixed";
    score: number;
  };
  processing_time_ms: number;
  model_used: string;
}

export interface ProposalValidation {
  is_valid: boolean;
  reason: string;
  recommended_subtopic: string;
  recommended_area: string;
  recommended_dimension: string;
  recommended_default_polarity: "positive" | "negative" | "context-dependent";
  closest_existing: Array<{
    subtopic: string;
    similarity: string;
  }>;
  merge_suggestion: string | null;
}

export interface SampleReview {
  id: string;
  language: string;
  text: string;
}

export const AREAS = [
  "Room", "Bathroom", "Housekeeping", "F&B", "Staff", "Front Desk",
  "Facilities", "Pool & Beach", "Spa & Wellness", "Entertainment",
  "Location", "Value", "General Experience", "Safety & Security",
  "Noise", "Maintenance", "Technology", "Accessibility",
  "Parking & Transport", "Sustainability", "Kids & Family",
  "Pet Policy", "Laundry",
] as const;

export const DIMENSIONS = [
  "Service Quality", "Cleanliness", "Condition", "Availability",
  "Aesthetics", "Size", "Food Quality", "Speed", "Value",
  "Comfort", "Ambiance", "Temperature", "Convenience",
  "Variety", "Noise", "Safety", "Sustainability",
] as const;

export type Area = (typeof AREAS)[number];
export type Dimension = (typeof DIMENSIONS)[number];
