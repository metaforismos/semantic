import { Question, PRIZE_LADDER, CHECKPOINT_INDICES } from "./types";

/** Fisher-Yates shuffle (returns new array) */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Select 15 questions: 5 easy, 5 medium, 5 hard.
 * Each tier is shuffled independently, then concatenated in order.
 */
export function selectQuestions(allQuestions: Question[]): Question[] {
  const easy = shuffle(allQuestions.filter((q) => q.difficulty === "easy")).slice(0, 5);
  const medium = shuffle(allQuestions.filter((q) => q.difficulty === "medium")).slice(0, 5);
  const hard = shuffle(allQuestions.filter((q) => q.difficulty === "hard")).slice(0, 5);
  return [...easy, ...medium, ...hard];
}

/** Get the prize for the current question index (0-based) */
export function getCurrentPrize(index: number): number {
  return PRIZE_LADDER[index] ?? 0;
}

/** Get the guaranteed score if the player answers wrong at this question index */
export function getCheckpointScore(index: number): number {
  // Walk backwards through checkpoints to find the last one passed
  for (let i = CHECKPOINT_INDICES.length - 1; i >= 0; i--) {
    if (index > CHECKPOINT_INDICES[i]) {
      return PRIZE_LADDER[CHECKPOINT_INDICES[i]];
    }
  }
  return 0;
}
