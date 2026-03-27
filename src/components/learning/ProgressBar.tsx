"use client";

interface Props {
  answered: number;
  correct: number;
  total: number;
}

export function ProgressBar({ answered, correct, total }: Props) {
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
  const correctPct = answered > 0 ? Math.round((correct / answered) * 100) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-muted font-medium">
          {answered}/{total} preguntas
        </span>
        <span className="text-text-dim">
          {correctPct}% correctas
        </span>
      </div>
      <div className="h-2.5 bg-surface-2 rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
