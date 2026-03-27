"use client";

import type { LeaderboardEntry } from "@/lib/learning/types";

const MEDALS = ["text-yellow-500", "text-gray-400", "text-amber-700"];

interface Props {
  scores: LeaderboardEntry[];
  onSelectPlayer?: (name: string) => void;
}

export function Leaderboard({ scores, onSelectPlayer }: Props) {
  if (scores.length === 0) {
    return (
      <div className="text-center py-8 text-text-dim text-sm">
        Aún no hay puntajes. ¡Juega para ser el primero!
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-text-dim border-b border-border">
            <th className="px-3 py-2 w-10">#</th>
            <th className="px-3 py-2">Jugador</th>
            <th className="px-3 py-2 text-right">Puntaje Total</th>
            <th className="px-3 py-2 text-right hidden sm:table-cell">Respuestas</th>
            <th className="px-3 py-2 text-right hidden sm:table-cell">Mejor</th>
            <th className="px-3 py-2 text-right hidden md:table-cell">Max. Pregunta</th>
          </tr>
        </thead>
        <tbody>
          {scores.map((entry, i) => (
            <tr
              key={entry.player_name}
              onClick={() => onSelectPlayer?.(entry.player_name)}
              className={`border-b border-border/50 text-[13px] transition-colors ${
                onSelectPlayer ? "cursor-pointer hover:bg-surface-2" : ""
              } ${i % 2 === 0 ? "" : "bg-surface-2/50"}`}
            >
              <td className="px-3 py-2.5">
                {i < 3 ? (
                  <span className={`text-lg font-bold ${MEDALS[i]}`}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                  </span>
                ) : (
                  <span className="text-text-dim">{i + 1}</span>
                )}
              </td>
              <td className="px-3 py-2.5 font-medium text-text">{entry.player_name}</td>
              <td className="px-3 py-2.5 text-right font-mono text-text-muted">
                {Number(entry.total_score).toLocaleString("es-CL")}
              </td>
              <td className="px-3 py-2.5 text-right text-text-dim hidden sm:table-cell">
                {entry.games_played}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-text-dim hidden sm:table-cell">
                {Number(entry.best_score).toLocaleString("es-CL")}
              </td>
              <td className="px-3 py-2.5 text-right text-text-dim hidden md:table-cell">
                {entry.highest_question}/15
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
