import type { Question } from "./types";

/** Fisher-Yates shuffle (returns new array) */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Create a shuffled order of all question IDs for a full training session */
export function createTrainingOrder(allQuestions: Question[]): string[] {
  // Shuffle within difficulty tiers then concatenate: easy → medium → hard
  const easy = shuffle(allQuestions.filter((q) => q.difficulty === "easy"));
  const medium = shuffle(allQuestions.filter((q) => q.difficulty === "medium"));
  const hard = shuffle(allQuestions.filter((q) => q.difficulty === "hard"));
  return [...easy, ...medium, ...hard].map((q) => q.id);
}

/** Build a lookup map from question ID → Question */
export function buildQuestionMap(questions: Question[]): Map<string, Question> {
  const map = new Map<string, Question>();
  for (const q of questions) map.set(q.id, q);
  return map;
}
