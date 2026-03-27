export interface Question {
  id: string;
  question: string;
  options: string[];
  correct: number; // 0-3
  difficulty: "easy" | "medium" | "hard";
  category: string;
  explanation: string;
}

export interface TeamMember {
  name: string;
  initials: string;
  role: string;
}

export type GameState = "idle" | "spinning" | "selected" | "playing" | "gameOver";

export interface AnswerRecord {
  questionId: string;
  category: string;
  isCorrect: boolean;
}

export interface GameSession {
  player: TeamMember;
  questions: Question[];
  currentIndex: number;
  answeredCount: number;
  correctCount: number;
  totalQuestions: number;
  answers: AnswerRecord[];
}

export interface TrainingProgress {
  player_name: string;
  answered_ids: string[];
  correct_ids: string[];
  current_index: number;
  question_order: string[];
  completed: boolean;
}

export const TIMER_SECONDS = 20;

export interface LeaderboardEntry {
  player_name: string;
  total_score: number;
  games_played: number;
  best_score: number;
  highest_question: number;
  updated_at: string;
}

export interface CategoryStat {
  category: string;
  correct: number;
  total: number;
  pct: number;
}

export const PRIZE_LADDER = [
  100, 200, 300, 500, 1_000,
  2_000, 4_000, 8_000, 16_000, 32_000,
  64_000, 125_000, 250_000, 500_000, 1_000_000,
] as const;

// Checkpoint question indices (0-based): Q5, Q10, Q15
export const CHECKPOINT_INDICES = [4, 9, 14] as const;
export const CHECKPOINT_VALUES: Record<number, number> = {
  4: 1_000,
  9: 32_000,
  14: 1_000_000,
};

// Each myHotel module/area as its own radar axis
export const RADAR_CATEGORIES = [
  { label: "Online", categories: ["Online"] },
  { label: "OnSite", categories: ["OnSite"] },
  { label: "Desk", categories: ["Desk"] },
  { label: "FollowUp", categories: ["FollowUp"] },
  { label: "Concierge", categories: ["Concierge"] },
  { label: "Semántico", categories: ["Semántico"] },
  { label: "Fidelity", categories: ["Fidelity General"] },
  { label: "Integraciones", categories: ["Integraciones"] },
  { label: "Corporativo", categories: ["Corporativo"] },
  { label: "Travel Tech", categories: ["Travel Tech SaaS"] },
  { label: "Hotelería", categories: ["Hotel Knowledge"] },
] as const;

export const SEGMENT_COLORS = [
  "#4f46e5", "#7c3aed", "#db2777", "#dc2626",
  "#ea580c", "#ca8a04", "#16a34a", "#0891b2",
];
