"use client";

import { useState } from "react";
import { SampleReview } from "@/lib/types";
import sampleData from "@/data/sample_reviews.json";

const samples = sampleData as SampleReview[];

const langFlags: Record<string, string> = {
  en: "EN", es: "ES", pt: "PT", fr: "FR", de: "DE",
};

interface ReviewInputProps {
  onAnalyze: (text: string) => void;
  isLoading: boolean;
}

export function ReviewInput({ onAnalyze, isLoading }: ReviewInputProps) {
  const [text, setText] = useState("");

  const handleSubmit = () => {
    if (text.trim() && !isLoading) {
      onAnalyze(text.trim());
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Review Input</h2>
        <span className="text-[11px] text-text-dim tabular-nums">
          {text.length > 0 ? `${text.length} chars` : ""}
        </span>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste a hotel guest review in any language..."
        className="flex-1 min-h-[200px] w-full bg-surface-2 border border-border rounded-lg p-4 text-sm text-text placeholder:text-text-dim resize-none focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-colors"
        disabled={isLoading}
      />

      <button
        onClick={handleSubmit}
        disabled={!text.trim() || isLoading}
        className="mt-3 w-full py-2.5 bg-accent hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Analyzing...
          </span>
        ) : (
          "Analyze Review"
        )}
      </button>

      <div className="mt-4">
        <div className="text-[11px] uppercase tracking-wider text-text-dim mb-2">Sample Reviews</div>
        <div className="flex flex-wrap gap-1.5">
          {samples.map((sample) => (
            <button
              key={sample.id}
              onClick={() => setText(sample.text)}
              disabled={isLoading}
              className="px-2.5 py-1 bg-surface-2 hover:bg-surface-3 border border-border text-xs text-text-muted rounded transition-colors disabled:opacity-40"
            >
              <span className="font-mono text-accent-light mr-1">{langFlags[sample.language] || sample.language.toUpperCase()}</span>
              {sample.id.replace("review-", "#")}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
