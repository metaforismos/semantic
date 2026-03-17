"use client";

import { useState, useRef } from "react";
import { Mention, ProposalValidation, MODEL_OPTIONS } from "@/lib/types";
import { SentimentBadge } from "@/components/SentimentBadge";
import { ConfidenceRing } from "@/components/ConfidenceRing";
import { usePrompts } from "@/components/PromptContext";

interface Proposal {
  mention: Mention;
  validation: ProposalValidation | null;
  status: "pending" | "validating" | "validated" | "approved" | "rejected" | "merged";
}

export default function ProposalsPage() {
  const { validationInstructions, isValidationCustom } = usePrompts();
  const [proposals, setProposals] = useState<Proposal[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = sessionStorage.getItem("semantic-proposals");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [validationModel, setValidationModel] = useState("claude-sonnet");
  const [bulkValidating, setBulkValidating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [addingToPool, setAddingToPool] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const persistProposals = (data: Proposal[]) => {
    try { sessionStorage.setItem("semantic-proposals", JSON.stringify(data)); } catch {}
  };

  const validateOne = async (proposal: Proposal, signal?: AbortSignal): Promise<ProposalValidation> => {
    const res = await fetch("/api/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proposed_subtopic: proposal.mention.proposed_subtopic,
        source_text: proposal.mention.original_text,
        proposed_area: proposal.mention.proposed_area || proposal.mention.area,
        proposed_dimension: proposal.mention.proposed_dimension || proposal.mention.dimension,
        model: validationModel,
        customPrompt: isValidationCustom ? validationInstructions : undefined,
      }),
      signal,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data as ProposalValidation;
  };

  const validate = async (index: number) => {
    const proposal = proposals[index];
    const updated = [...proposals];
    updated[index] = { ...proposal, status: "validating" };
    setProposals(updated);

    try {
      const validation = await validateOne(proposal);
      updated[index] = { ...proposal, status: "validated", validation };
      setProposals(updated);
      persistProposals(updated);
    } catch {
      updated[index] = { ...proposal, status: "pending" };
      setProposals(updated);
    }
  };

  const validateAll = async () => {
    const pendingIndices = proposals
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.status === "pending")
      .map(({ i }) => i);

    if (pendingIndices.length === 0) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setBulkValidating(true);
    setBulkProgress({ current: 0, total: pendingIndices.length });

    const CONCURRENCY = 2;
    let completed = 0;
    const latest = [...proposals];

    // Mark all as validating
    for (const idx of pendingIndices) {
      latest[idx] = { ...latest[idx], status: "validating" };
    }
    setProposals([...latest]);

    for (let i = 0; i < pendingIndices.length; i += CONCURRENCY) {
      if (controller.signal.aborted) break;

      const chunk = pendingIndices.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map((idx) => validateOne(latest[idx], controller.signal))
      );

      results.forEach((result, j) => {
        const idx = chunk[j];
        if (result.status === "fulfilled") {
          latest[idx] = { ...latest[idx], status: "validated", validation: result.value };
        } else {
          latest[idx] = { ...latest[idx], status: "pending" };
        }
        completed++;
      });

      setBulkProgress({ current: completed, total: pendingIndices.length });
      setProposals([...latest]);
      persistProposals(latest);

      if (i + CONCURRENCY < pendingIndices.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    setBulkValidating(false);
    setBulkProgress(null);
  };

  const addApprovedToPool = async () => {
    const approved = proposals.filter((p) => p.status === "approved");
    if (approved.length === 0) return;

    setAddingToPool(true);
    try {
      const res = await fetch("/api/pool/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subtopics: approved.map((p) => ({
            subtopic: p.validation?.recommended_subtopic || p.mention.proposed_subtopic,
            area: p.validation?.recommended_area || p.mention.proposed_area || p.mention.area,
            dimension: p.validation?.recommended_dimension || p.mention.proposed_dimension || p.mention.dimension,
            default_polarity: p.validation?.recommended_default_polarity || "context-dependent",
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Remove approved from proposals list
      const remaining = proposals.filter((p) => p.status !== "approved");
      setProposals(remaining);
      persistProposals(remaining);
    } catch (err) {
      console.error("Failed to add to pool:", err);
    } finally {
      setAddingToPool(false);
    }
  };

  const updateStatus = (index: number, status: Proposal["status"]) => {
    const updated = [...proposals];
    updated[index] = { ...updated[index], status };
    setProposals(updated);
    persistProposals(updated);
  };

  const pendingCount = proposals.filter((p) => p.status === "pending").length;
  const approvedCount = proposals.filter((p) => p.status === "approved").length;

  return (
    <div className="pt-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Subtopic Proposals</h1>
          <p className="text-sm text-text-muted">
            New subtopics proposed by the extraction engine when no pool match was found.
            {pendingCount > 0 && <span className="text-labs-yellow ml-1">{pendingCount} pending review</span>}
            {approvedCount > 0 && <span className="text-positive ml-1">{approvedCount} approved</span>}
          </p>
        </div>
        {proposals.length > 0 && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <span className="text-[11px] uppercase tracking-wider text-text-dim">Validation model</span>
            <select
              value={validationModel}
              onChange={(e) => setValidationModel(e.target.value)}
              disabled={bulkValidating}
              className="px-2.5 py-1.5 bg-surface-2 border border-border rounded-md text-xs text-text-muted"
            >
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
            {pendingCount > 0 && (
              <button
                onClick={validateAll}
                disabled={bulkValidating}
                className="px-3 py-1.5 bg-accent hover:bg-accent-light disabled:opacity-40 text-white text-xs font-semibold rounded-md transition-colors"
              >
                {bulkValidating && bulkProgress
                  ? `Validating ${bulkProgress.current}/${bulkProgress.total}...`
                  : `Validate All (${pendingCount})`}
              </button>
            )}
            {approvedCount > 0 && (
              <button
                onClick={addApprovedToPool}
                disabled={addingToPool || bulkValidating}
                className="px-3 py-1.5 bg-positive/80 hover:bg-positive disabled:opacity-40 text-white text-xs font-semibold rounded-md transition-colors"
              >
                {addingToPool ? "Adding..." : `Add ${approvedCount} to Pool`}
              </button>
            )}
          </div>
        )}
      </div>

      {proposals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-border flex items-center justify-center mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-dim">
              <path d="M12 5v14" /><path d="M5 12h14" />
            </svg>
          </div>
          <p className="text-sm text-text-dim mb-1">No proposals yet</p>
          <p className="text-xs text-text-dim/70">Run an analysis — proposals appear when the engine can&apos;t match a subtopic from the pool</p>
        </div>
      ) : (
        <div className="space-y-4">
          {proposals.map((proposal, i) => (
            <div
              key={`${proposal.mention.id}-${i}`}
              className={`animate-fade-in bg-surface rounded-lg border border-border p-5 ${
                proposal.status === "approved" ? "border-l-[3px] border-l-positive opacity-60"
                  : proposal.status === "rejected" ? "border-l-[3px] border-l-negative opacity-40"
                    : proposal.status === "merged" ? "border-l-[3px] border-l-accent opacity-60"
                      : "border-l-[3px] border-l-labs-yellow"
              }`}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1">
                  <span className="text-xs font-mono text-labs-yellow bg-labs-yellow-bg px-2 py-0.5 rounded">
                    {proposal.mention.proposed_subtopic}
                  </span>
                  <p className="text-sm text-text-muted mt-2 italic">
                    &ldquo;{proposal.mention.original_text}&rdquo;
                  </p>
                </div>
                <ConfidenceRing value={proposal.mention.confidence} />
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-surface-3 text-text-muted text-xs rounded">
                  {proposal.mention.proposed_area || proposal.mention.area}
                </span>
                <span className="px-2 py-0.5 bg-surface-3 text-text-muted text-xs rounded">
                  {proposal.mention.proposed_dimension || proposal.mention.dimension}
                </span>
                <SentimentBadge polarity={proposal.mention.polarity} intensity={proposal.mention.intensity} />
              </div>

              {/* Validation result */}
              {proposal.validation && (
                <div className="bg-surface-2 rounded-md p-3 mb-3 text-xs">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`font-semibold ${proposal.validation.is_valid ? "text-positive" : "text-negative"}`}>
                      {proposal.validation.is_valid ? "Valid — genuinely new" : "Invalid — duplicate or variant"}
                    </span>
                  </div>
                  <p className="text-text-muted mb-2">{proposal.validation.reason}</p>
                  {proposal.validation.closest_existing.length > 0 && (
                    <div>
                      <span className="text-text-dim">Closest existing:</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {proposal.validation.closest_existing.map((c, ci) => (
                          <span key={ci} className="px-1.5 py-0.5 bg-surface-3 text-text-muted rounded font-mono" title={c.similarity}>
                            {c.subtopic}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {proposal.validation.merge_suggestion && (
                    <p className="mt-2 text-accent-light">
                      Merge with: <span className="font-mono">{proposal.validation.merge_suggestion}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              {!["approved", "rejected", "merged"].includes(proposal.status) && (
                <div className="flex items-center gap-2">
                  {!proposal.validation && (
                    <button
                      onClick={() => validate(i)}
                      disabled={proposal.status === "validating"}
                      className="px-3 py-1.5 bg-accent/15 hover:bg-accent/25 text-accent-light text-xs font-medium rounded transition-colors disabled:opacity-40"
                    >
                      {proposal.status === "validating" ? "Validating..." : `Validate (${MODEL_OPTIONS.find((m) => m.id === validationModel)?.label || validationModel})`}
                    </button>
                  )}
                  <button
                    onClick={() => updateStatus(i, "approved")}
                    className="px-3 py-1.5 bg-positive-muted/40 hover:bg-positive-muted/60 text-positive text-xs font-medium rounded transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => updateStatus(i, "rejected")}
                    className="px-3 py-1.5 bg-negative-muted/40 hover:bg-negative-muted/60 text-negative text-xs font-medium rounded transition-colors"
                  >
                    Reject
                  </button>
                  {proposal.validation?.merge_suggestion && (
                    <button
                      onClick={() => updateStatus(i, "merged")}
                      className="px-3 py-1.5 bg-accent/15 hover:bg-accent/25 text-accent-light text-xs font-medium rounded transition-colors"
                    >
                      Merge with {proposal.validation.merge_suggestion}
                    </button>
                  )}
                </div>
              )}

              {/* Status badge for resolved */}
              {["approved", "rejected", "merged"].includes(proposal.status) && (
                <div className={`text-xs font-semibold uppercase tracking-wider ${
                  proposal.status === "approved" ? "text-positive"
                    : proposal.status === "merged" ? "text-accent-light" : "text-negative"
                }`}>
                  {proposal.status}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
