"use client";

import { useState, useRef, useCallback } from "react";
import { ReviewInput } from "@/components/ReviewInput";
import { MentionCard } from "@/components/MentionCard";
import { AnalysisSummary } from "@/components/AnalysisSummary";
import { ReviewAnalysis } from "@/lib/types";
import { usePrompts } from "@/components/PromptContext";

export default function AnalysisPage() {
  const { extractionInstructions, isExtractionCustom } = usePrompts();
  const [analyses, setAnalyses] = useState<ReviewAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const analyzeOne = useCallback(async (
    reviewText: string,
    model: string,
    reviewId: string,
    signal: AbortSignal,
  ): Promise<ReviewAnalysis> => {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: reviewText,
        reviewId,
        model,
        customPrompt: isExtractionCustom ? extractionInstructions : undefined,
      }),
      signal,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Analysis failed");
    return data as ReviewAnalysis;
  }, [extractionInstructions, isExtractionCustom]);

  const handleAnalyze = async (text: string, model: string) => {
    const reviews = text.split(";").map((r) => r.trim()).filter(Boolean);
    const isBatch = reviews.length > 1;
    const CONCURRENCY = 2;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);
    setAnalyses([]);
    setBatchProgress(isBatch ? { current: 0, total: reviews.length } : null);

    const results: ReviewAnalysis[] = new Array(reviews.length);
    let completed = 0;

    try {
      // Process in chunks of CONCURRENCY
      for (let i = 0; i < reviews.length; i += CONCURRENCY) {
        if (controller.signal.aborted) break;

        const chunk = reviews.slice(i, i + CONCURRENCY);
        const promises = chunk.map((review, j) => {
          const idx = i + j;
          const reviewId = `review-${Date.now()}-${idx}`;
          return analyzeOne(review, model, reviewId, controller.signal).then((result) => {
            results[idx] = result;
            completed++;
            if (isBatch) setBatchProgress({ current: completed, total: reviews.length });
            setAnalyses(results.filter(Boolean));
          });
        });

        await Promise.all(promises);

        // Small pause between chunks to avoid rate limits
        if (i + CONCURRENCY < reviews.length) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      // Store proposals
      const allResults = results.filter(Boolean);
      const newProposals = allResults
        .flatMap((r) => r.mentions)
        .filter((m) => m.proposed_subtopic)
        .map((m) => ({ mention: m, validation: null, status: "pending" }));
      if (newProposals.length > 0) {
        try {
          const existing = JSON.parse(sessionStorage.getItem("semantic-proposals") || "[]");
          sessionStorage.setItem("semantic-proposals", JSON.stringify([...newProposals, ...existing]));
        } catch {}
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
      setBatchProgress(null);
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
          <ReviewInput onAnalyze={handleAnalyze} isLoading={isLoading} batchProgress={batchProgress} />
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

          {analyses.length > 0 && analyses.map((analysis, reviewIdx) => (
            <div key={analysis.id} className="animate-fade-in">
              {analyses.length > 1 && (
                <div className="flex items-center gap-2 mb-3 mt-6 first:mt-0">
                  <span className="text-xs font-semibold text-accent-light bg-accent/10 px-2 py-0.5 rounded">
                    Review {reviewIdx + 1}/{analyses.length}
                  </span>
                  <span className="text-xs text-text-dim truncate max-w-[300px]">
                    {analysis.raw_text.slice(0, 80)}{analysis.raw_text.length > 80 ? "..." : ""}
                  </span>
                </div>
              )}
              <AnalysisSummary analysis={analysis} />
              <div className="space-y-3">
                {analysis.mentions.map((mention, i) => (
                  <MentionCard key={mention.id} mention={mention} index={i} />
                ))}
              </div>
            </div>
          ))}

          {!isLoading && !error && analyses.length === 0 && (
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
