"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Question } from "@/lib/learning/types";
import { TIMER_SECONDS } from "@/lib/learning/types";
import { ProgressBar } from "./ProgressBar";

const OPTION_LETTERS = ["A", "B", "C", "D"];

interface Props {
  question: Question;
  questionIndex: number;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  onAnswer: (optionIndex: number, isCorrect: boolean) => void;
  onTimeout: () => void;
}

export function QuestionDisplay({
  question,
  questionIndex,
  totalQuestions,
  answeredCount,
  correctCount,
  onAnswer,
  onTimeout,
}: Props) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutFiredRef = useRef(false);

  // Reset state when question changes
  useEffect(() => {
    setSelectedOption(null);
    setRevealed(false);
    setTimeLeft(TIMER_SECONDS);
    timeoutFiredRef.current = false;
  }, [question.id]);

  // Countdown timer
  useEffect(() => {
    if (revealed) return; // Pause during reveal

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          if (!timeoutFiredRef.current) {
            timeoutFiredRef.current = true;
            // Use setTimeout to avoid state update during render
            setTimeout(() => onTimeout(), 0);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [question.id, revealed, onTimeout]);

  const handleSelect = useCallback(
    (idx: number) => {
      if (selectedOption !== null) return;
      if (timerRef.current) clearInterval(timerRef.current);

      setSelectedOption(idx);
      setRevealed(true);
    },
    [selectedOption]
  );

  const handleNext = useCallback(() => {
    if (selectedOption === null) return;
    onAnswer(selectedOption, selectedOption === question.correct);
  }, [selectedOption, question.correct, onAnswer]);

  // Timer color
  const timerPct = timeLeft / TIMER_SECONDS;
  const timerColor =
    timerPct > 0.5 ? "text-positive" : timerPct > 0.25 ? "text-labs-yellow" : "text-negative";
  const timerBarColor =
    timerPct > 0.5 ? "bg-positive" : timerPct > 0.25 ? "bg-labs-yellow" : "bg-negative";

  const getOptionClass = (idx: number) => {
    const base =
      "flex items-center gap-3 p-4 rounded-lg border-2 text-left transition-all font-medium text-[14px]";
    if (!revealed) {
      if (selectedOption === idx) {
        return `${base} border-labs-yellow bg-labs-yellow-bg text-text`;
      }
      return `${base} border-border bg-surface hover:border-accent/40 hover:bg-accent/5 cursor-pointer`;
    }
    if (idx === question.correct) {
      return `${base} border-positive bg-positive-muted text-text`;
    }
    if (idx === selectedOption && idx !== question.correct) {
      return `${base} border-negative bg-negative-muted text-text animate-shake`;
    }
    return `${base} border-border bg-surface opacity-50`;
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Progress bar */}
      <ProgressBar answered={answeredCount} correct={correctCount} total={totalQuestions} />

      {/* Question header + timer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-dim">
            Pregunta {questionIndex + 1} de {totalQuestions}
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-surface-2 text-text-dim capitalize">
            {question.difficulty === "easy" ? "Fácil" : question.difficulty === "medium" ? "Media" : "Difícil"}
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-surface-2 text-text-dim">
            {question.category}
          </span>
        </div>

        {/* Timer */}
        {!revealed && (
          <div className="flex items-center gap-2">
            <span className={`text-lg font-bold font-mono ${timerColor}`}>
              {timeLeft}s
            </span>
          </div>
        )}
      </div>

      {/* Timer bar */}
      {!revealed && (
        <div className="h-1 bg-surface-2 rounded-full overflow-hidden">
          <div
            className={`h-full ${timerBarColor} rounded-full transition-all duration-1000 linear`}
            style={{ width: `${timerPct * 100}%` }}
          />
        </div>
      )}

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
        <div className="animate-fade-in pb-20">
          <div className="p-4 bg-surface-2 rounded-lg border border-border">
            <p className="text-sm text-text-muted">
              <span className="font-semibold text-text">Explicación: </span>
              {question.explanation}
            </p>
          </div>
        </div>
      )}

      {/* Sticky Next button */}
      {revealed && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface/95 backdrop-blur-sm border-t border-border z-50">
          <button
            onClick={handleNext}
            className="w-full max-w-2xl mx-auto block py-3 rounded-lg bg-accent text-white font-semibold text-sm hover:bg-accent/90 transition-colors"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
