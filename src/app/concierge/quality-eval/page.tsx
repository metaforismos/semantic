"use client";

import { QualityUploadForm } from "@/components/concierge/QualityUploadForm";
import { QualityDashboard } from "@/components/concierge/QualityDashboard";
import { QualityEvolution } from "@/components/concierge/QualityEvolution";
import { useQualityAnalysis } from "@/components/concierge/QualityContext";
import type { CSVParseResult } from "@/lib/concierge/types";
import type { PromptParseResult, QualityUploadFormData, QualityEvalReport } from "@/lib/concierge/quality-types";

export default function QualityEvalPage() {
  const { progress, report, isProcessing, startAnalysis, cancelAnalysis, setReport } = useQualityAnalysis();

  const handleParsed = (
    convResult: CSVParseResult,
    promptResult: PromptParseResult,
    formData: QualityUploadFormData
  ) => {
    startAnalysis(convResult, promptResult, formData);
  };

  const handleViewReport = (historicalReport: QualityEvalReport) => {
    setReport(historicalReport);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="pt-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Quality Eval</h1>
        <p className="text-sm text-text-muted">
          Evaluate conversation quality across 7 dimensions, attribute issues to pipeline workers, and generate prompt improvement proposals.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        {/* Left: Upload */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <QualityUploadForm onParsed={handleParsed} disabled={isProcessing} />
        </div>

        {/* Right: Results */}
        <div className="min-w-0">
          {/* Progress */}
          {isProcessing && progress && (
            <div className="animate-fade-in space-y-3">
              <div className="bg-surface border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{progress.message}</span>
                  <button
                    onClick={cancelAnalysis}
                    className="text-xs text-negative hover:underline"
                  >
                    Cancelar
                  </button>
                </div>
                {progress.total_batches > 0 && (
                  <div className="w-full bg-surface-2 rounded-full h-2">
                    <div
                      className="bg-accent h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(progress.current_batch / progress.total_batches) * 100}%` }}
                    />
                  </div>
                )}
                {progress.stage === "proposing" && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-2 h-2 rounded-full bg-accent animate-pulse-slow" />
                    <span className="text-xs text-text-muted">Generating improvement proposals...</span>
                  </div>
                )}
              </div>
              <div className="skeleton h-40 rounded-lg" />
              <div className="skeleton h-28 rounded-lg" />
            </div>
          )}

          {/* Error */}
          {progress?.stage === "error" && (
            <div className="animate-fade-in bg-negative-muted/30 border border-negative/30 rounded-lg p-4 text-sm text-negative">
              {progress.message}
            </div>
          )}

          {/* Report */}
          {report && !isProcessing && (
            <QualityDashboard report={report} />
          )}

          {/* Empty state */}
          {!isProcessing && !report && !progress && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-border flex items-center justify-center mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-dim">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <p className="text-sm text-text-dim mb-1">No evaluation yet</p>
              <p className="text-xs text-text-dim/70">Upload conversations + pipeline prompts CSVs to start</p>
            </div>
          )}

          {/* Evolution History */}
          {!isProcessing && (
            <div className={report ? "mt-8" : ""}>
              <h2 className="text-lg font-semibold mb-4">Evolution History</h2>
              <QualityEvolution onViewReport={handleViewReport} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
