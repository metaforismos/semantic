"use client";

import { useMemo } from "react";
import type { GameSession } from "@/lib/learning/types";
import { PRIZE_LADDER } from "@/lib/learning/types";

interface Props {
  session: GameSession;
  onPlayAgain: () => void;
}

const CONFETTI_COLORS = ["#4f46e5", "#7c3aed", "#db2777", "#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#0891b2"];

export function GameResult({ session, onPlayAgain }: Props) {
  const isMillionaire = session.score === 1_000_000;
  const questionsRight = session.answers.filter((a) => a.isCorrect).length;

  const confettiPieces = useMemo(() => {
    if (!isMillionaire) return null;
    return Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 1.5,
      duration: 1.5 + Math.random() * 1.5,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rotation: Math.random() * 360,
    }));
  }, [isMillionaire]);

  let title: string;
  let subtitle: string;
  if (isMillionaire) {
    title = "¡¡¡MILLONARIO!!!";
    subtitle = `${session.player.name} respondió las 15 preguntas correctamente`;
  } else if (session.walkedAway) {
    title = "¡Buena decisión!";
    subtitle = `${session.player.name} se retiró en la pregunta ${session.answers.length + 1}`;
  } else {
    title = "¡Fin del juego!";
    const failedAt = session.answers.length;
    subtitle = `${session.player.name} falló en la pregunta ${failedAt}`;
  }

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
        <h2 className={`text-3xl font-bold ${isMillionaire ? "text-labs-yellow" : "text-text"}`}>
          {title}
        </h2>
        <p className="text-text-muted">{subtitle}</p>
      </div>

      {/* Score */}
      <div className="py-4">
        <div className="text-sm text-text-dim uppercase tracking-wider mb-1">Puntaje final</div>
        <div className={`text-5xl font-bold font-mono ${isMillionaire ? "text-labs-yellow" : "text-accent"}`}>
          {session.score.toLocaleString("es-CL")}
        </div>
        <div className="text-xs text-text-dim mt-1">puntos</div>
      </div>

      {/* Stats */}
      <div className="flex justify-center gap-6 text-sm">
        <div className="text-center">
          <div className="text-lg font-bold text-text">{questionsRight}</div>
          <div className="text-text-dim">Correctas</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-text">{session.answers.length}</div>
          <div className="text-text-dim">Respondidas</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-text">
            {session.walkedAway ? "Sí" : "No"}
          </div>
          <div className="text-text-dim">Se retiró</div>
        </div>
      </div>

      {/* Prize breakdown */}
      {!isMillionaire && !session.walkedAway && session.answers.length > 0 && (
        <div className="text-sm text-text-dim">
          Cayó al checkpoint: {session.score.toLocaleString("es-CL")} pts
          {session.answers.length > 0 && (
            <span>
              {" "}(estaba en{" "}
              {PRIZE_LADDER[session.answers.length - 1]?.toLocaleString("es-CL")} pts)
            </span>
          )}
        </div>
      )}

      <button
        onClick={onPlayAgain}
        className="px-8 py-3 bg-accent text-white font-bold rounded-xl hover:bg-accent-light transition-colors text-lg"
      >
        Jugar de nuevo
      </button>
    </div>
  );
}
