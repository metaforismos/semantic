"use client";

import { useState } from "react";
import { ReviewInput } from "@/components/ReviewInput";
import { MentionCard } from "@/components/MentionCard";
import { AnalysisSummary } from "@/components/AnalysisSummary";
import { ReviewAnalysis } from "@/lib/types";
import { usePrompts } from "@/components/PromptContext";

export default function AnalysisPage() {
  const { extractionInstructions, isExtractionCustom } = usePrompts();
  const [analysis, setAnalysis] = useState<ReviewAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (text: string, model: string) => {
    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          reviewId: `review-${Date.now()}`,
          model,
          customPrompt: isExtractionCustom ? extractionInstructions : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      setAnalysis(data);

      // Store proposals in sessionStorage for the Proposals page
      const newProposals = (data as ReviewAnalysis).mentions
        .filter((m) => m.proposed_subtopic)
        .map((m) => ({ mention: m, validation: null, status: "pending" }));
      if (newProposals.length > 0) {
        try {
          const existing = JSON.parse(sessionStorage.getItem("semantic-proposals") || "[]");
          sessionStorage.setItem("semantic-proposals", JSON.stringify([...newProposals, ...existing]));
        } catch {}
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="pt-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Review Analysis</h1>
        <p className="text-sm text-text-muted">
          Paste a guest review to extract structured opinion intelligence across Area, Dimension, and Sentiment axes.
          {isExtractionCustom && (
            <span className="ml-2 inline-flex items-center gap-1 text-labs-yellow text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-labs-yellow" />
              Custom prompt active
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        {/* Left: Input */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <ReviewInput onAnalyze={handleAnalyze} isLoading={isLoading} />
        </div>

        {/* Right: Results */}
        <div className="min-w-0">
          {isLoading && (
            <div className="space-y-4">
              <div className="skeleton h-40 rounded-lg" />
              <div className="skeleton h-28 rounded-lg" />
              <div className="skeleton h-28 rounded-lg" />
            </div>
          )}

          {error && (
            <div className="animate-fade-in bg-negative-muted/30 border border-negative/30 rounded-lg p-4 text-sm text-negative">
              {error}
            </div>
          )}

          {analysis && (
            <>
              <AnalysisSummary analysis={analysis} />
              <div className="space-y-3">
                {analysis.mentions.map((mention, i) => (
                  <MentionCard key={mention.id} mention={mention} index={i} />
                ))}
              </div>
            </>
          )}

          {!isLoading && !error && !analysis && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-border flex items-center justify-center mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-dim">
                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                  <rect x="9" y="3" width="6" height="4" rx="1" />
                  <path d="M9 12h6" />
                  <path d="M9 16h3" />
                </svg>
              </div>
              <p className="text-sm text-text-dim mb-1">No analysis yet</p>
              <p className="text-xs text-text-dim/70">Paste a review or pick a sample to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
