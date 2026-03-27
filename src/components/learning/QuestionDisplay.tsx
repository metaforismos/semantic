"use client";

import { useState, useCallback } from "react";
import type { Question } from "@/lib/learning/types";
import { PRIZE_LADDER, CHECKPOINT_INDICES } from "@/lib/learning/types";

const OPTION_LETTERS = ["A", "B", "C", "D"];

interface Props {
  question: Question;
  questionIndex: number;
  onAnswer: (optionIndex: number, isCorrect: boolean) => void;
  onRetire: () => void;
}

export function QuestionDisplay({ question, questionIndex, onAnswer, onRetire }: Props) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  const handleSelect = useCallback(
    (idx: number) => {
      if (selectedOption !== null) return;
      setSelectedOption(idx);
      setRevealed(true);

      // Delay before advancing
      setTimeout(() => {
        onAnswer(idx, idx === question.correct);
        setSelectedOption(null);
        setRevealed(false);
      }, 2200);
    },
    [selectedOption, question.correct, onAnswer]
  );

  const getOptionClass = (idx: number) => {
    const base =
      "flex items-center gap-3 p-4 rounded-lg border-2 text-left transition-all font-medium text-[14px]";
    if (!revealed) {
      if (selectedOption === idx) {
        return `${base} border-labs-yellow bg-labs-yellow-bg text-text`;
      }
      return `${base} border-border bg-surface hover:border-accent/40 hover:bg-accent/5 cursor-pointer`;
    }
    // Revealed state
    if (idx === question.correct) {
      return `${base} border-positive bg-positive-muted text-text`;
    }
    if (idx === selectedOption && idx !== question.correct) {
      return `${base} border-negative bg-negative-muted text-text animate-shake`;
    }
    return `${base} border-border bg-surface opacity-50`;
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 animate-fade-in">
      {/* Main question area */}
      <div className="flex-1 space-y-5">
        {/* Question header */}
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-dim">
            Pregunta {questionIndex + 1} de 15
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-surface-2 text-text-dim capitalize">
            {question.difficulty === "easy" ? "Fácil" : question.difficulty === "medium" ? "Media" : "Difícil"}
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-surface-2 text-text-dim">
            {question.category}
          </span>
        </div>

        {/* Question text */}
        <div className="bg-accent rounded-xl p-6">
          <p className="text-white text-lg font-semibold leading-relaxed">
            {question.question}
          </p>
        </div>

        {/* Options grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {question.options.map((opt, idx) => (
            <button
              key={idx}
              onClick={() => handleSelect(idx)}
              disabled={selectedOption !== null}
              className={getOptionClass(idx)}
            >
              <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-surface-2 text-sm font-bold text-text-muted">
                {OPTION_LETTERS[idx]}
              </span>
              <span>{opt}</span>
            </button>
          ))}
        </div>

        {/* Explanation */}
        {revealed && (
          <div className="p-4 bg-surface-2 rounded-lg border border-border animate-fade-in">
            <p className="text-sm text-text-muted">
              <span className="font-semibold text-text">Explicación: </span>
              {question.explanation}
            </p>
          </div>
        )}

        {/* Retire button */}
        {!revealed && (
          <button
            onClick={onRetire}
            className="text-sm text-text-dim hover:text-text transition-colors underline underline-offset-2"
          >
            Retirarse con {PRIZE_LADDER[questionIndex].toLocaleString("es-CL")} pts
          </button>
        )}
      </div>

      {/* Prize ladder */}
      <div className="w-full lg:w-48 shrink-0">
        <div className="bg-surface border border-border rounded-lg p-2 space-y-0.5">
          {[...PRIZE_LADDER].reverse().map((prize, revIdx) => {
            const idx = PRIZE_LADDER.length - 1 - revIdx;
            const isCurrent = idx === questionIndex;
            const isPassed = idx < questionIndex;
            const isCheckpoint = CHECKPOINT_INDICES.includes(idx as 4 | 9 | 14);

            return (
              <div
                key={idx}
                className={`flex items-center justify-between px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  isCurrent
                    ? "bg-labs-yellow-bg text-labs-yellow font-bold"
                    : isPassed
                    ? "text-text-dim"
                    : "text-text-muted"
                } ${isCheckpoint && !isCurrent ? "border-l-2 border-accent" : ""}`}
              >
                <span>{idx + 1}</span>
                <span>{prize.toLocaleString("es-CL")}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
