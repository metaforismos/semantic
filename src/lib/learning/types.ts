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
  score: number;
  answers: AnswerRecord[];
  walkedAway: boolean;
}

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

// Group 11 categories into 7 radar axes for readability
export const RADAR_CATEGORIES = [
  { label: "Online", categories: ["Online"] },
  { label: "OnSite", categories: ["OnSite"] },
  { label: "Desk & Follow", categories: ["Desk", "FollowUp"] },
  { label: "Concierge", categories: ["Concierge"] },
  { label: "Semántico", categories: ["Semántico"] },
  { label: "Producto", categories: ["Fidelity General", "Integraciones", "Corporativo"] },
  { label: "Industria", categories: ["Travel Tech SaaS", "Hotel Knowledge"] },
] as const;

export const SEGMENT_COLORS = [
  "#4f46e5", "#7c3aed", "#db2777", "#dc2626",
  "#ea580c", "#ca8a04", "#16a34a", "#0891b2",
];
