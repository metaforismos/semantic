"use client";

import { useState } from "react";
import { Mention, ProposalValidation } from "@/lib/types";
import { SentimentBadge } from "@/components/SentimentBadge";
import { ConfidenceRing } from "@/components/ConfidenceRing";

interface Proposal {
  mention: Mention;
  validation: ProposalValidation | null;
  status: "pending" | "validating" | "validated" | "approved" | "rejected" | "merged";
}

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = sessionStorage.getItem("semantic-proposals");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const validate = async (index: number) => {
    const proposal = proposals[index];
    const updated = [...proposals];
    updated[index] = { ...proposal, status: "validating" };
    setProposals(updated);

    try {
      const res = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposed_subtopic: proposal.mention.proposed_subtopic,
          source_text: proposal.mention.original_text,
          proposed_area: proposal.mention.proposed_area || proposal.mention.area,
          proposed_dimension: proposal.mention.proposed_dimension || proposal.mention.dimension,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      updated[index] = { ...proposal, status: "validated", validation: data };
      setProposals(updated);
      persistProposals(updated);
    } catch {
      updated[index] = { ...proposal, status: "pending" };
      setProposals(updated);
    }
  };

  const updateStatus = (index: number, status: Proposal["status"]) => {
    const updated = [...proposals];
    updated[index] = { ...updated[index], status };
    setProposals(updated);
    persistProposals(updated);
  };

  const persistProposals = (data: Proposal[]) => {
    try { sessionStorage.setItem("semantic-proposals", JSON.stringify(data)); } catch {}
  };

  const pendingCount = proposals.filter((p) => ["pending", "validating", "validated"].includes(p.status)).length;

  return (
    <div className="pt-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Subtopic Proposals</h1>
        <p className="text-sm text-text-muted">
          New subtopics proposed by the extraction engine when no pool match was found.
          {pendingCount > 0 && <span className="text-labs-yellow ml-1">{pendingCount} pending review</span>}
        </p>
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
                  <span className="text-xs font-mono text-labs-yellow bg-labs-yellow/10 px-2 py-0.5 rounded">
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
                      {proposal.status === "validating" ? "Validating..." : "Validate (Sonnet)"}
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
