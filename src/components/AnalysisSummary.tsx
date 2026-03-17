"use client";

import { ReviewAnalysis } from "@/lib/types";

interface AnalysisSummaryProps {
  analysis: ReviewAnalysis;
}

export function AnalysisSummary({ analysis }: AnalysisSummaryProps) {
  const { mentions, overall_sentiment, source_language, processing_time_ms } = analysis;

  const positive = mentions.filter((m) => m.polarity === "positive").length;
  const negative = mentions.filter((m) => m.polarity === "negative").length;
  const neutral = mentions.filter((m) => m.polarity === "neutral").length;
  const total = mentions.length;
  const avgConfidence = total > 0 ? mentions.reduce((sum, m) => sum + m.confidence, 0) / total : 0;
  const proposalCount = mentions.filter((m) => m.proposed_subtopic).length;

  const dimensions = [...new Set(mentions.map((m) => m.dimension).filter(Boolean))];

  const langNames: Record<string, string> = {
    en: "English", es: "Spanish", pt: "Portuguese", fr: "French", de: "German",
    it: "Italian", zh: "Chinese", ja: "Japanese", ko: "Korean",
  };

  return (
    <div className="animate-fade-in bg-surface rounded-lg border border-border p-5 mb-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-text-dim mb-1">Mentions</div>
          <div className="text-2xl font-bold tabular-nums">{total}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-text-dim mb-1">Avg Confidence</div>
          <div className="text-2xl font-bold tabular-nums">{Math.round(avgConfidence * 100)}%</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-text-dim mb-1">Language</div>
          <div className="text-2xl font-bold">{langNames[source_language] || source_language}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-text-dim mb-1">Time</div>
          <div className="text-2xl font-bold tabular-nums">{(processing_time_ms / 1000).toFixed(1)}s</div>
        </div>
      </div>

      {/* Polarity bar */}
      <div className="mb-4">
        <div className="flex items-center gap-3 text-xs text-text-muted mb-1.5">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-positive" />{positive} positive</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-negative" />{negative} negative</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-neutral-sent" />{neutral} neutral</span>
          {proposalCount > 0 && (
            <span className="ml-auto flex items-center gap-1 text-labs-yellow">
              <span className="w-2 h-2 rounded-full bg-labs-yellow" />{proposalCount} new proposed
            </span>
          )}
        </div>
        <div className="flex h-2 rounded-full overflow-hidden bg-surface-3">
          {positive > 0 && (
            <div className="bg-positive transition-all" style={{ width: `${(positive / total) * 100}%` }} />
          )}
          {neutral > 0 && (
            <div className="bg-neutral-sent transition-all" style={{ width: `${(neutral / total) * 100}%` }} />
          )}
          {negative > 0 && (
            <div className="bg-negative transition-all" style={{ width: `${(negative / total) * 100}%` }} />
          )}
        </div>
      </div>

      {/* Dimension pills */}
      <div className="flex flex-wrap gap-1.5">
        {dimensions.map((dim) => (
          <span key={dim} className="px-2 py-0.5 bg-surface-2 text-text-muted text-[11px] rounded">
            {dim}
          </span>
        ))}
      </div>

      {/* Overall score */}
      <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-xs text-text-dim">
        Overall:
        <span className={`font-semibold ${
          overall_sentiment.polarity === "positive" ? "text-positive"
            : overall_sentiment.polarity === "negative" ? "text-negative"
              : overall_sentiment.polarity === "mixed" ? "text-neutral-sent" : "text-text-muted"
        }`}>
          {overall_sentiment.polarity} ({overall_sentiment.score > 0 ? "+" : ""}{overall_sentiment.score})
        </span>
      </div>
    </div>
  );
}
