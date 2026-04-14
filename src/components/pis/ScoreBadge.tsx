"use client";

import { SCORE_THRESHOLDS } from "@/lib/pis/constants";

export function ScoreBadge({
  score,
  size = "md",
}: {
  score: number | null;
  size?: "sm" | "md" | "lg";
}) {
  if (score === null || score === undefined) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-3 text-text-dim">
        Sin evaluar
      </span>
    );
  }

  const color =
    score >= SCORE_THRESHOLDS.GREEN
      ? "bg-positive-muted text-positive"
      : score >= SCORE_THRESHOLDS.YELLOW
        ? "bg-neutral-muted text-neutral-sent"
        : "bg-negative-muted text-negative";

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-2xl px-4 py-2 font-bold",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md font-semibold ${color} ${sizeClasses[size]}`}
    >
      {score}%
    </span>
  );
}
