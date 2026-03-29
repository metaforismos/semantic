"use client";

import { useEffect, useState, useCallback } from "react";
import { DIMENSION_LABELS } from "@/lib/concierge/quality-types";
import type { QualityDimension } from "@/lib/concierge/quality-types";

interface EvalSummary {
  id: number;
  period_start: string;
  period_end: string;
  total_conversations: number;
  hotel_count: number;
  overall_quality_score: number;
  dimension_scores: Record<string, number>;
  proposals_count: number;
  notes: string;
  created_at: string;
}

interface EvolutionAnalysis {
  overall_trend: "improved" | "declined" | "stable";
  overall_delta: number;
  headline: string;
  dimension_changes: {
    dimension: string;
    previous_score: number;
    current_score: number;
    delta: number;
    trend: "improved" | "declined" | "stable";
    insight: string;
  }[];
  worker_changes: {
    worker: string;
    previous_issues: number;
    current_issues: number;
    insight: string;
  }[];
  proposals_impact: string;
  recommendations: string[];
}

function trendIcon(trend: string) {
  if (trend === "improved") return "↑";
  if (trend === "declined") return "↓";
  return "→";
}

function trendColor(trend: string) {
  if (trend === "improved") return "text-positive";
  if (trend === "declined") return "text-negative";
  return "text-text-dim";
}

function deltaDisplay(delta: number) {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(2)}`;
}

export function QualityEvolution() {
  const [evaluations, setEvaluations] = useState<EvalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [compareIds, setCompareIds] = useState<{ prev: number; curr: number } | null>(null);
  const [evolution, setEvolution] = useState<EvolutionAnalysis | null>(null);
  const [evolutionLoading, setEvolutionLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/concierge/quality-eval/evaluations");
        if (res.ok) {
          const data = await res.json();
          setEvaluations(data.evaluations || []);
        }
      } catch (err) {
        console.warn("Failed to load evaluations:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const runComparison = useCallback(async (prevId: number, currId: number) => {
    setCompareIds({ prev: prevId, curr: currId });
    setEvolutionLoading(true);
    setEvolution(null);
    try {
      const res = await fetch("/api/concierge/quality-eval/evolution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previous_id: prevId, current_id: currId }),
      });
      if (res.ok) {
        const data = await res.json();
        setEvolution(data.analysis);
      }
    } catch (err) {
      console.warn("Failed to generate evolution:", err);
    } finally {
      setEvolutionLoading(false);
    }
  }, []);

  if (loading) {
    return <div className="skeleton h-40 rounded-lg" />;
  }

  if (evaluations.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-text-dim">
        No hay evaluaciones guardadas. Ejecuta tu primera evaluación para comenzar a trackear evolución.
      </div>
    );
  }

  // Chronological for the chart (oldest first)
  const chronological = [...evaluations].reverse();

  return (
    <div className="space-y-6">
      {/* Score Evolution Chart */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Score Evolution</h3>
        <ScoreChart evaluations={chronological} />
      </div>

      {/* History Table */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Evaluation History</h3>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-2">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold text-text-dim">Period</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-text-dim">Convs</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-text-dim">Score</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-text-dim">Proposals</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-text-dim">Date</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-text-dim"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {evaluations.map((ev, idx) => {
                const prevEval = evaluations[idx + 1]; // evaluations are DESC, so idx+1 is the previous one
                const scoreColor = ev.overall_quality_score >= 4
                  ? "text-positive" : ev.overall_quality_score >= 3
                  ? "text-neutral-sent" : "text-negative";

                return (
                  <tr key={ev.id} className="hover:bg-surface-2/50">
                    <td className="px-3 py-2 text-xs">
                      {ev.period_start} → {ev.period_end}
                    </td>
                    <td className="px-3 py-2 text-right">{ev.total_conversations}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${scoreColor}`}>
                      {ev.overall_quality_score.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-right">{ev.proposals_count}</td>
                    <td className="px-3 py-2 text-right text-xs text-text-dim">
                      {new Date(ev.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {prevEval && (
                        <button
                          onClick={() => runComparison(prevEval.id, ev.id)}
                          disabled={evolutionLoading}
                          className="text-[10px] font-medium px-2 py-1 border border-border rounded hover:bg-surface-2 transition-colors disabled:opacity-50"
                        >
                          vs anterior
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Evolution Analysis */}
      {evolutionLoading && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse-slow" />
            <span className="text-sm text-text-muted">Generating evolution analysis with Gemini...</span>
          </div>
          <div className="skeleton h-32 rounded-lg" />
        </div>
      )}

      {evolution && !evolutionLoading && (
        <EvolutionPanel analysis={evolution} />
      )}
    </div>
  );
}

function ScoreChart({ evaluations }: { evaluations: EvalSummary[] }) {
  if (evaluations.length < 2) {
    return (
      <div className="border border-border rounded-lg p-4">
        <div className="flex items-end gap-3 h-32">
          {evaluations.map((ev) => (
            <div key={ev.id} className="flex flex-col items-center flex-1">
              <span className="text-lg font-bold text-accent">{ev.overall_quality_score.toFixed(1)}</span>
              <div
                className="w-full bg-accent/20 rounded-t mt-1"
                style={{ height: `${(ev.overall_quality_score / 5) * 80}px` }}
              >
                <div
                  className="w-full bg-accent rounded-t"
                  style={{ height: `${(ev.overall_quality_score / 5) * 80}px` }}
                />
              </div>
              <span className="text-[10px] text-text-dim mt-1">{ev.period_end}</span>
              <span className="text-[10px] text-text-dim">n={ev.total_conversations}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const maxScore = 5;
  const chartHeight = 120;
  const padding = 24;

  return (
    <div className="border border-border rounded-lg p-4">
      <div className="relative" style={{ height: chartHeight + padding * 2 }}>
        {/* Y axis labels */}
        {[1, 2, 3, 4, 5].map((v) => (
          <div
            key={v}
            className="absolute left-0 text-[10px] text-text-dim"
            style={{ bottom: padding + ((v - 1) / (maxScore - 1)) * chartHeight - 6 }}
          >
            {v}
          </div>
        ))}

        {/* Grid lines */}
        {[1, 2, 3, 4, 5].map((v) => (
          <div
            key={v}
            className="absolute left-6 right-0 border-t border-border/50"
            style={{ bottom: padding + ((v - 1) / (maxScore - 1)) * chartHeight }}
          />
        ))}

        {/* Data points + lines */}
        <svg
          className="absolute left-6 right-0 top-0 bottom-0"
          style={{ width: `calc(100% - 24px)`, height: "100%" }}
          preserveAspectRatio="none"
        >
          {evaluations.map((ev, i) => {
            if (i === 0) return null;
            const prev = evaluations[i - 1];
            const x1 = ((i - 1) / (evaluations.length - 1)) * 100;
            const x2 = (i / (evaluations.length - 1)) * 100;
            const y1 = 100 - ((prev.overall_quality_score - 1) / (maxScore - 1)) * (chartHeight / (chartHeight + padding * 2)) * 100 - (padding / (chartHeight + padding * 2)) * 100;
            const y2 = 100 - ((ev.overall_quality_score - 1) / (maxScore - 1)) * (chartHeight / (chartHeight + padding * 2)) * 100 - (padding / (chartHeight + padding * 2)) * 100;
            return (
              <line
                key={i}
                x1={`${x1}%`} y1={`${y1}%`}
                x2={`${x2}%`} y2={`${y2}%`}
                stroke="var(--color-accent)"
                strokeWidth="2"
              />
            );
          })}
          {evaluations.map((ev, i) => {
            const x = (i / (evaluations.length - 1)) * 100;
            const y = 100 - ((ev.overall_quality_score - 1) / (maxScore - 1)) * (chartHeight / (chartHeight + padding * 2)) * 100 - (padding / (chartHeight + padding * 2)) * 100;
            return (
              <circle
                key={i}
                cx={`${x}%`} cy={`${y}%`}
                r="4"
                fill="var(--color-accent)"
                stroke="var(--color-surface)"
                strokeWidth="2"
              />
            );
          })}
        </svg>

        {/* X axis labels */}
        {evaluations.map((ev, i) => {
          const x = evaluations.length === 1 ? 50 : (i / (evaluations.length - 1)) * 100;
          return (
            <div
              key={ev.id}
              className="absolute text-center"
              style={{ left: `calc(24px + ${x}% * (100% - 24px) / 100%)`, bottom: 0, transform: "translateX(-50%)" }}
            >
              <div className="text-[10px] font-semibold text-accent">{ev.overall_quality_score.toFixed(1)}</div>
              <div className="text-[9px] text-text-dim">{ev.period_end}</div>
              <div className="text-[9px] text-text-dim">n={ev.total_conversations}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EvolutionPanel({ analysis }: { analysis: EvolutionAnalysis }) {
  return (
    <div className="border border-border rounded-lg overflow-hidden animate-fade-in">
      {/* Header */}
      <div className={`p-4 ${
        analysis.overall_trend === "improved" ? "bg-positive-muted/50" :
        analysis.overall_trend === "declined" ? "bg-negative-muted/50" :
        "bg-surface-2"
      }`}>
        <div className="flex items-center gap-3">
          <span className={`text-2xl ${trendColor(analysis.overall_trend)}`}>
            {trendIcon(analysis.overall_trend)}
          </span>
          <div>
            <div className="text-sm font-semibold">{analysis.headline}</div>
            <div className={`text-xs font-mono ${trendColor(analysis.overall_trend)}`}>
              {deltaDisplay(analysis.overall_delta)} overall
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Dimension Changes */}
        {analysis.dimension_changes && analysis.dimension_changes.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-2">Changes by Dimension</h4>
            <div className="space-y-1.5">
              {analysis.dimension_changes.map((dc) => (
                <div key={dc.dimension} className="flex items-center gap-2 text-sm">
                  <span className={`text-xs font-mono w-6 ${trendColor(dc.trend)}`}>
                    {trendIcon(dc.trend)}
                  </span>
                  <span className="text-xs font-medium min-w-[100px]">
                    {DIMENSION_LABELS[dc.dimension as QualityDimension] || dc.dimension}
                  </span>
                  <span className="text-xs text-text-dim">
                    {dc.previous_score.toFixed(1)} → {dc.current_score.toFixed(1)}
                  </span>
                  <span className={`text-[10px] font-mono ${trendColor(dc.trend)}`}>
                    ({deltaDisplay(dc.delta)})
                  </span>
                  <span className="text-xs text-text-muted flex-1">{dc.insight}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Proposals Impact */}
        {analysis.proposals_impact && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-2">Proposals Impact</h4>
            <p className="text-sm text-text">{analysis.proposals_impact}</p>
          </div>
        )}

        {/* Recommendations */}
        {analysis.recommendations && analysis.recommendations.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-2">Recommendations</h4>
            <ul className="space-y-1">
              {analysis.recommendations.map((rec, i) => (
                <li key={i} className="text-sm text-text flex gap-2">
                  <span className="text-accent">•</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
