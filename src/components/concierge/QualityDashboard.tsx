"use client";

import { useState } from "react";
import type {
  QualityEvalReport,
  QualityDimension,
  DimensionAggregate,
  WorkerAttribution,
  QualityProposal,
  QualityIssue,
  ConversationQualityAnalysis,
} from "@/lib/concierge/quality-types";
import { DIMENSION_LABELS, DIMENSION_DESCRIPTIONS } from "@/lib/concierge/quality-types";

interface QualityDashboardProps {
  report: QualityEvalReport;
}

function scoreColor(score: number): string {
  if (score >= 4) return "text-positive";
  if (score >= 3) return "text-neutral-sent";
  return "text-negative";
}

function scoreBg(score: number): string {
  if (score >= 4) return "bg-positive-muted border-positive/20";
  if (score >= 3) return "bg-neutral-muted border-neutral-sent/20";
  return "bg-negative-muted border-negative/20";
}

function severityColor(severity: string): string {
  switch (severity) {
    case "critical": return "bg-negative text-white";
    case "high": return "bg-negative/20 text-negative";
    case "medium": return "bg-neutral-muted text-neutral-sent";
    default: return "bg-surface-2 text-text-dim";
  }
}

function priorityColor(priority: string): string {
  switch (priority) {
    case "critical": return "bg-negative text-white";
    case "high": return "bg-negative/20 text-negative";
    case "medium": return "bg-neutral-muted text-neutral-sent";
    default: return "bg-surface-2 text-text-dim";
  }
}

export function QualityDashboard({ report }: QualityDashboardProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "issues" | "proposals" | "conversations">("overview");
  const [expandedConv, setExpandedConv] = useState<string | null>(null);
  const [filterDimension, setFilterDimension] = useState<QualityDimension | "all">("all");
  const [filterWorker, setFilterWorker] = useState<string>("all");

  const tabs = [
    { key: "overview" as const, label: "Overview" },
    { key: "issues" as const, label: `Issues (${report.conversation_analyses.reduce((sum, a) => sum + Object.values(a.dimensions).reduce((s, d) => s + d.issues.length, 0), 0)})` },
    { key: "proposals" as const, label: `Proposals (${report.proposals.length})` },
    { key: "conversations" as const, label: `Conversations (${report.conversation_analyses.length})` },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Quality Evaluation</h2>
          <p className="text-sm text-text-muted">
            {report.meta.total_conversations} conversaciones · {report.meta.hotel_count} hotel(es) ·{" "}
            {report.meta.period_start} → {report.meta.period_end}
          </p>
        </div>
        <button
          onClick={() => {
            const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `quality-eval-${report.meta.period_start}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="text-xs font-medium px-3 py-1.5 border border-border rounded-lg hover:bg-surface-2 transition-colors"
        >
          Export JSON
        </button>
      </div>

      {/* Overall Score */}
      <div className={`flex items-center gap-4 p-4 rounded-lg border ${scoreBg(report.overall_quality_score)}`}>
        <div className={`text-4xl font-bold ${scoreColor(report.overall_quality_score)}`}>
          {report.overall_quality_score.toFixed(1)}
        </div>
        <div>
          <div className="text-sm font-medium">Overall Quality Score</div>
          <div className="text-xs text-text-muted">Weighted average across 7 dimensions</div>
        </div>
      </div>

      {/* Dimension Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {report.dimensions.map((dim) => (
          <DimensionCard key={dim.dimension} dim={dim} />
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-accent text-accent-light"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <OverviewTab report={report} />
      )}
      {activeTab === "issues" && (
        <IssuesTab
          report={report}
          filterDimension={filterDimension}
          setFilterDimension={setFilterDimension}
          filterWorker={filterWorker}
          setFilterWorker={setFilterWorker}
        />
      )}
      {activeTab === "proposals" && (
        <ProposalsTab proposals={report.proposals} />
      )}
      {activeTab === "conversations" && (
        <ConversationsTab
          analyses={report.conversation_analyses}
          expandedConv={expandedConv}
          setExpandedConv={setExpandedConv}
        />
      )}
    </div>
  );
}

function DimensionCard({ dim }: { dim: DimensionAggregate }) {
  return (
    <div className={`p-3 rounded-lg border ${scoreBg(dim.avg_score)}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-dim">
          {DIMENSION_LABELS[dim.dimension]}
        </span>
        <span className={`text-lg font-bold ${scoreColor(dim.avg_score)}`}>
          {dim.avg_score.toFixed(1)}
        </span>
      </div>
      <div className="text-[11px] text-text-dim" title={DIMENSION_DESCRIPTIONS[dim.dimension]}>
        {dim.total_issues} issues · {Math.round(dim.rate * 100)}%{" "}
        {dim.dimension === "resolution" ? "resolved" : "affected"}
      </div>
      {dim.total_issues > 0 && (
        <div className="flex gap-1 mt-1.5">
          {dim.severity_distribution.critical > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-negative text-white">
              {dim.severity_distribution.critical} crit
            </span>
          )}
          {dim.severity_distribution.high > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-negative/20 text-negative">
              {dim.severity_distribution.high} high
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function OverviewTab({ report }: { report: QualityEvalReport }) {
  return (
    <div className="space-y-6">
      {/* Worker Attribution Table */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Worker Attribution Ranking</h3>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-2">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold text-text-dim">Worker</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-text-dim">Issues</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-text-dim">Dimensions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {report.worker_attributions.map((wa) => (
                <tr key={wa.worker} className="hover:bg-surface-2/50">
                  <td className="px-3 py-2 font-mono text-xs">{wa.worker}</td>
                  <td className="px-3 py-2 text-right font-semibold">{wa.total_issues}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(wa.by_dimension)
                        .filter(([, count]) => count > 0)
                        .sort(([, a], [, b]) => b - a)
                        .map(([dim, count]) => (
                          <span key={dim} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-text-muted">
                            {DIMENSION_LABELS[dim as QualityDimension] || dim}({count})
                          </span>
                        ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Issue Heatmap */}
      {Object.keys(report.issue_heatmap).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Issue Heatmap (Worker x Dimension)</h3>
          <div className="border border-border rounded-lg overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface-2">
                <tr>
                  <th className="text-left px-2 py-2 font-semibold text-text-dim">Worker</th>
                  {report.dimensions.map((d) => (
                    <th key={d.dimension} className="px-2 py-2 font-semibold text-text-dim text-center">
                      {DIMENSION_LABELS[d.dimension].slice(0, 6)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Object.entries(report.issue_heatmap).map(([worker, dims]) => (
                  <tr key={worker} className="hover:bg-surface-2/50">
                    <td className="px-2 py-1.5 font-mono">{worker}</td>
                    {report.dimensions.map((d) => {
                      const count = dims[d.dimension] || 0;
                      return (
                        <td key={d.dimension} className="px-2 py-1.5 text-center">
                          {count > 0 ? (
                            <span className={`inline-block min-w-[20px] px-1 py-0.5 rounded ${
                              count >= 5 ? "bg-negative text-white" :
                              count >= 3 ? "bg-negative/20 text-negative" :
                              "bg-neutral-muted text-neutral-sent"
                            }`}>
                              {count}
                            </span>
                          ) : (
                            <span className="text-text-dim">·</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Hotel Breakdown (if multi-hotel) */}
      {report.hotel_breakdowns.length > 1 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Per-Hotel Comparison</h3>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-2">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-text-dim">Hotel ID</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-text-dim">Convs</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-text-dim">Quality</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.hotel_breakdowns.map((h) => (
                  <tr key={h.customer_id} className="hover:bg-surface-2/50">
                    <td className="px-3 py-2 font-mono">{h.customer_id}</td>
                    <td className="px-3 py-2 text-right">{h.conversation_count}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${scoreColor(h.avg_quality_score)}`}>
                      {h.avg_quality_score.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function IssuesTab({
  report,
  filterDimension,
  setFilterDimension,
  filterWorker,
  setFilterWorker,
}: {
  report: QualityEvalReport;
  filterDimension: QualityDimension | "all";
  setFilterDimension: (v: QualityDimension | "all") => void;
  filterWorker: string;
  setFilterWorker: (v: string) => void;
}) {
  // Collect all issues with conversation context
  const allIssues: { issue: QualityIssue; dimension: QualityDimension; conversationId: string }[] = [];
  for (const analysis of report.conversation_analyses) {
    for (const dim of Object.keys(analysis.dimensions) as QualityDimension[]) {
      for (const issue of analysis.dimensions[dim]?.issues ?? []) {
        allIssues.push({ issue, dimension: dim, conversationId: analysis.conversation_id });
      }
    }
  }

  const workers = [...new Set(allIssues.map((i) => i.issue.responsible_worker))].sort();

  const filtered = allIssues.filter((i) => {
    if (filterDimension !== "all" && i.dimension !== filterDimension) return false;
    if (filterWorker !== "all" && i.issue.responsible_worker !== filterWorker) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={filterDimension}
          onChange={(e) => setFilterDimension(e.target.value as QualityDimension | "all")}
          className="text-sm border border-border rounded px-2 py-1.5 bg-surface focus:outline-none focus:border-accent"
        >
          <option value="all">All dimensions</option>
          {report.dimensions.map((d) => (
            <option key={d.dimension} value={d.dimension}>
              {DIMENSION_LABELS[d.dimension]} ({d.total_issues})
            </option>
          ))}
        </select>
        <select
          value={filterWorker}
          onChange={(e) => setFilterWorker(e.target.value)}
          className="text-sm border border-border rounded px-2 py-1.5 bg-surface focus:outline-none focus:border-accent"
        >
          <option value="all">All workers</option>
          {workers.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
      </div>

      <div className="text-xs text-text-dim">{filtered.length} issues</div>

      {/* Issue list */}
      <div className="space-y-2">
        {filtered.slice(0, 100).map((item, i) => (
          <div key={i} className="border border-border rounded-lg p-3 hover:bg-surface-2/50 transition-colors">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${severityColor(item.issue.severity)}`}>
                {item.issue.severity}
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent/10 text-accent-light">
                {DIMENSION_LABELS[item.dimension]}
              </span>
              <span className="text-[10px] font-mono text-text-dim">
                {item.issue.responsible_worker}
              </span>
              <span className="text-[10px] text-text-dim ml-auto">
                {item.conversationId}
              </span>
            </div>
            <p className="text-sm text-text">{item.issue.explanation}</p>
            {item.issue.text_fragment && (
              <p className="text-xs text-text-muted mt-1 italic">
                &ldquo;{item.issue.text_fragment}&rdquo;
              </p>
            )}
            {item.issue.message_order && (
              <span className="text-[10px] text-text-dim mt-1 inline-block">msg #{item.issue.message_order}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProposalsTab({ proposals }: { proposals: QualityProposal[] }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  if (proposals.length === 0) {
    return <div className="text-sm text-text-muted py-8 text-center">No se generaron propuestas.</div>;
  }

  return (
    <div className="space-y-4">
      {proposals.map((proposal, i) => (
        <div key={i} className="border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${priorityColor(proposal.priority)}`}>
              {proposal.priority}
            </span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent/10 text-accent-light">
              {DIMENSION_LABELS[proposal.category] || proposal.category}
            </span>
            <span className="font-mono text-xs text-text-muted">
              {proposal.target_worker} v{proposal.target_version}
            </span>
          </div>

          <p className="text-sm text-text mb-2">{proposal.problem}</p>

          {proposal.evidence.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              <span className="text-[10px] text-text-dim">Evidence:</span>
              {proposal.evidence.map((convId) => (
                <span key={convId} className="text-[10px] font-mono bg-surface-2 px-1.5 py-0.5 rounded">
                  {convId}
                </span>
              ))}
            </div>
          )}

          {/* Proposed change */}
          <div className="bg-surface-2 rounded-lg p-3 mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-dim">
                Proposed: {proposal.proposed_change.type}
                {proposal.proposed_change.location && ` → ${proposal.proposed_change.location}`}
              </span>
              {(proposal.proposed_change.text || proposal.proposed_change.description) && (
                <button
                  onClick={() => {
                    const text = proposal.proposed_change.text || proposal.proposed_change.description || "";
                    navigator.clipboard.writeText(text);
                    setCopiedIdx(i);
                    setTimeout(() => setCopiedIdx(null), 2000);
                  }}
                  className="text-[10px] font-medium px-2 py-0.5 border border-border rounded hover:bg-surface transition-colors"
                >
                  {copiedIdx === i ? "Copied!" : "Copy"}
                </button>
              )}
            </div>
            {proposal.proposed_change.text && (
              <pre className="text-xs text-text font-mono whitespace-pre-wrap mt-1">{proposal.proposed_change.text}</pre>
            )}
            {proposal.proposed_change.description && (
              <p className="text-xs text-text mt-1">{proposal.proposed_change.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ConversationsTab({
  analyses,
  expandedConv,
  setExpandedConv,
}: {
  analyses: ConversationQualityAnalysis[];
  expandedConv: string | null;
  setExpandedConv: (v: string | null) => void;
}) {
  const sorted = [...analyses].sort((a, b) => a.overall_quality_score - b.overall_quality_score);

  return (
    <div className="space-y-2">
      {sorted.map((a) => {
        const isExpanded = expandedConv === a.conversation_id;
        const issueCount = Object.values(a.dimensions).reduce((sum, d) => sum + d.issues.length, 0);

        return (
          <div key={a.conversation_id} className="border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedConv(isExpanded ? null : a.conversation_id)}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-surface-2/50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className={`text-lg font-bold ${scoreColor(a.overall_quality_score)}`}>
                  {a.overall_quality_score.toFixed(1)}
                </span>
                <span className="text-sm font-mono text-text-muted">{a.conversation_id}</span>
                <span className="text-xs text-text-dim">hotel:{a.customer_id}</span>
              </div>
              <div className="flex items-center gap-2">
                {issueCount > 0 && (
                  <span className="text-[10px] bg-negative/10 text-negative px-1.5 py-0.5 rounded">
                    {issueCount} issues
                  </span>
                )}
                <svg
                  width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"
                  className={`text-text-dim transition-transform ${isExpanded ? "rotate-180" : ""}`}
                >
                  <path d="M3 5l3 3 3-3" />
                </svg>
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-border px-3 py-3 space-y-2 bg-surface-2/30">
                {(Object.entries(a.dimensions) as [QualityDimension, { score: number; issues: QualityIssue[] }][]).map(
                  ([dim, data]) => (
                    <div key={dim} className="flex items-start gap-2">
                      <span className={`text-xs font-semibold min-w-[24px] ${scoreColor(data.score)}`}>
                        {data.score}
                      </span>
                      <span className="text-xs font-medium text-text-muted min-w-[120px]">
                        {DIMENSION_LABELS[dim]}
                      </span>
                      <div className="flex-1">
                        {data.issues.length === 0 ? (
                          <span className="text-[10px] text-text-dim">OK</span>
                        ) : (
                          <div className="space-y-1">
                            {data.issues.map((issue, idx) => (
                              <div key={idx} className="text-xs text-text">
                                <span className={`inline-block text-[10px] px-1 py-0.5 rounded mr-1 ${severityColor(issue.severity)}`}>
                                  {issue.severity}
                                </span>
                                <span className="font-mono text-text-dim mr-1">[{issue.responsible_worker}]</span>
                                {issue.explanation}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
