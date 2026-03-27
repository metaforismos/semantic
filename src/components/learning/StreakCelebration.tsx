"use client";

import { useEffect, useState } from "react";

const MILESTONES: Record<number, { emoji: string; label: string; confetti: boolean }> = {
  3: { emoji: "🔥", label: "¡Racha de 3!", confetti: false },
  5: { emoji: "⚡", label: "¡Racha de 5!", confetti: false },
  10: { emoji: "🏆", label: "¡Racha de 10!", confetti: true },
  20: { emoji: "💎", label: "¡Racha de 20!", confetti: true },
  30: { emoji: "🌟", label: "¡Racha de 30!", confetti: true },
  50: { emoji: "👑", label: "¡Racha de 50!", confetti: true },
};

export const STREAK_MILESTONES = Object.keys(MILESTONES).map(Number);

interface Props {
  streak: number;
  onDone: () => void;
}

export function StreakCelebration({ streak, onDone }: Props) {
  const [visible, setVisible] = useState(true);
  const milestone = MILESTONES[streak];

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 300);
    }, 2500);
    return () => clearTimeout(timer);
  }, [onDone]);

  if (!milestone) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center pointer-events-none transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Confetti for big milestones */}
      {milestone.confetti && (
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-sm"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-5%`,
                backgroundColor: ["#4f46e5", "#db2777", "#ea580c", "#16a34a", "#ca8a04", "#7c3aed"][i % 6],
                animation: `confetti-fall ${1.5 + Math.random() * 1.5}s ${Math.random() * 0.5}s ease-out forwards`,
                transform: `rotate(${Math.random() * 360}deg)`,
              }}
            />
          ))}
        </div>
      )}

      {/* Central badge */}
      <div className="animate-streak-pop text-center">
        <div className="text-7xl mb-2">{milestone.emoji}</div>
        <div className="bg-surface/95 backdrop-blur-sm border border-accent/30 rounded-2xl px-8 py-4 shadow-xl">
          <div className="text-3xl font-black text-accent font-mono">{streak}</div>
          <div className="text-sm font-bold text-text mt-1">{milestone.label}</div>
          <div className="text-xs text-text-dim mt-0.5">respuestas correctas seguidas</div>
        </div>
      </div>
    </div>
  );
}
