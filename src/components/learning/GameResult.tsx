"use client";

import { useMemo } from "react";

interface Props {
  playerName: string;
  answeredCount: number;
  correctCount: number;
  totalQuestions: number;
  onPlayAgain: () => void;
}

const CONFETTI_COLORS = ["#4f46e5", "#7c3aed", "#db2777", "#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#0891b2"];

export function GameResult({ playerName, answeredCount, correctCount, totalQuestions, onPlayAgain }: Props) {
  const isComplete = answeredCount >= totalQuestions;
  const correctPct = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;

  const confettiPieces = useMemo(() => {
    if (!isComplete) return null;
    return Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 1.5,
      duration: 1.5 + Math.random() * 1.5,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rotation: Math.random() * 360,
    }));
  }, [isComplete]);

  return (
    <div className="relative text-center space-y-6 py-8 animate-scale-in overflow-hidden">
      {/* Confetti */}
      {confettiPieces && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {confettiPieces.map((p) => (
            <div
              key={p.id}
              className="absolute w-2.5 h-2.5 rounded-sm"
              style={{
                left: `${p.left}%`,
                top: "-10px",
                backgroundColor: p.color,
                transform: `rotate(${p.rotation}deg)`,
                animation: `confetti-fall ${p.duration}s ${p.delay}s ease-out forwards`,
              }}
            />
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h2 className={`text-3xl font-bold ${isComplete ? "text-labs-yellow" : "text-text"}`}>
          {isComplete ? "¡Entrenamiento completado!" : "Progreso guardado"}
        </h2>
        <p className="text-text-muted">
          {isComplete
            ? `${playerName} completó las ${totalQuestions} preguntas`
            : `${playerName} lleva ${answeredCount} de ${totalQuestions} preguntas`}
        </p>
      </div>

      {/* Stats */}
      <div className="flex justify-center gap-8 text-sm">
        <div className="text-center">
          <div className="text-2xl font-bold text-text">{answeredCount}</div>
          <div className="text-text-dim">Respondidas</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-positive">{correctCount}</div>
          <div className="text-text-dim">Correctas</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-text">{correctPct}%</div>
          <div className="text-text-dim">Precisión</div>
        </div>
      </div>

      <button
        onClick={onPlayAgain}
        className="px-8 py-3 bg-accent text-white font-bold rounded-xl hover:bg-accent-light transition-colors text-lg"
      >
        Volver al inicio
      </button>
    </div>
  );
}
