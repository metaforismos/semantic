"use client";

import type { AnalysisProgress } from "@/lib/concierge/types";

interface ProgressBarProps {
  progress: AnalysisProgress;
}

const stageLabels: Record<string, string> = {
  parsing: "Procesando CSV...",
  metrics: "Calculando métricas...",
  llm: "Analizando conversaciones con IA...",
  aggregating: "Generando reporte...",
  done: "Reporte listo",
  error: "Error en el procesamiento",
};

export function ProgressBar({ progress }: ProgressBarProps) {
  const pct =
    progress.stage === "llm" && progress.total_batches > 0
      ? (progress.current_batch / progress.total_batches) * 100
      : progress.stage === "done"
      ? 100
      : progress.stage === "error"
      ? 0
      : undefined;

  return (
    <div className="bg-surface border border-border rounded-lg p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-text">
          {stageLabels[progress.stage] || progress.message}
        </span>
        {pct !== undefined && (
          <span className="text-xs font-medium text-text-muted">{Math.round(pct)}%</span>
        )}
      </div>

      {pct !== undefined && (
        <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {progress.stage === "llm" && (
        <div className="text-xs text-text-dim mt-2">{progress.message}</div>
      )}

      {progress.stage !== "done" && progress.stage !== "error" && (
        <div className="flex items-center gap-2 mt-2">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse-slow" />
          <span className="text-xs text-text-dim">Procesando...</span>
        </div>
      )}
    </div>
  );
}
