import type {
  ConversationQualityAnalysis,
  QualityEvalReport,
  QualityUploadFormData,
  DimensionAggregate,
  WorkerAttribution,
  HotelBreakdown,
  QualityProposal,
  QualityDimension,
  QUALITY_DIMENSIONS,
} from "./quality-types";

const DIMENSIONS: QualityDimension[] = [
  "hallucination",
  "false_agency",
  "avoidable_derivation",
  "resolution",
  "tone",
  "language_match",
  "continuity",
];

const DIMENSION_WEIGHTS: Record<QualityDimension, number> = {
  hallucination: 2,
  false_agency: 2,
  avoidable_derivation: 1,
  resolution: 1.5,
  tone: 1,
  language_match: 1,
  continuity: 1.5,
};

/** Compute weighted overall quality score from dimension scores */
export function computeWeightedScore(dimensions: Record<string, { score: number }>): number {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const dim of DIMENSIONS) {
    const score = dimensions[dim]?.score ?? 5;
    const weight = DIMENSION_WEIGHTS[dim];
    weightedSum += score * weight;
    totalWeight += weight;
  }
  return Math.round((weightedSum / totalWeight) * 100) / 100;
}

export function aggregateQualityReport(
  analyses: ConversationQualityAnalysis[],
  proposals: QualityProposal[],
  formData: QualityUploadFormData
): QualityEvalReport {
  if (analyses.length === 0) {
    throw new Error("No analyses to aggregate");
  }

  // Overall quality score
  const overallScores = analyses.map((a) => a.overall_quality_score);
  const overallAvg = overallScores.reduce((sum, s) => sum + s, 0) / overallScores.length;

  // Dimension aggregates
  const dimensions: DimensionAggregate[] = DIMENSIONS.map((dim) => {
    const scores = analyses.map((a) => a.dimensions[dim]?.score ?? 5);
    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const allIssues = analyses.flatMap((a) => a.dimensions[dim]?.issues ?? []);
    const severityDist: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const issue of allIssues) {
      severityDist[issue.severity] = (severityDist[issue.severity] || 0) + 1;
    }

    // Rate depends on dimension:
    // For resolution: % with score >= 4 (higher is better)
    // For others: % with at least 1 issue (lower is better)
    let rate: number;
    if (dim === "resolution") {
      rate = scores.filter((s) => s >= 4).length / scores.length;
    } else {
      rate = analyses.filter((a) => (a.dimensions[dim]?.issues?.length ?? 0) > 0).length / analyses.length;
    }

    return {
      dimension: dim,
      avg_score: Math.round(avgScore * 100) / 100,
      rate: Math.round(rate * 100) / 100,
      total_issues: allIssues.length,
      severity_distribution: severityDist,
    };
  });

  // Worker attributions
  const workerMap = new Map<string, WorkerAttribution>();
  for (const analysis of analyses) {
    for (const dim of DIMENSIONS) {
      for (const issue of analysis.dimensions[dim]?.issues ?? []) {
        const worker = issue.responsible_worker || "UNKNOWN";
        const existing = workerMap.get(worker) || {
          worker,
          total_issues: 0,
          by_dimension: {},
          top_issues: [],
        };
        existing.total_issues++;
        existing.by_dimension[dim] = (existing.by_dimension[dim] || 0) + 1;
        existing.top_issues.push(issue);
        workerMap.set(worker, existing);
      }
    }
  }

  const workerAttributions = [...workerMap.values()]
    .map((w) => ({
      ...w,
      top_issues: w.top_issues
        .sort((a, b) => {
          const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          return (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
        })
        .slice(0, 10),
    }))
    .sort((a, b) => b.total_issues - a.total_issues);

  // Hotel breakdowns
  const hotelMap = new Map<number, ConversationQualityAnalysis[]>();
  for (const a of analyses) {
    const list = hotelMap.get(a.customer_id) || [];
    list.push(a);
    hotelMap.set(a.customer_id, list);
  }

  const hotelBreakdowns: HotelBreakdown[] = [...hotelMap.entries()].map(([customerId, hotelAnalyses]) => {
    const dimScores: Record<QualityDimension, number> = {} as Record<QualityDimension, number>;
    for (const dim of DIMENSIONS) {
      const scores = hotelAnalyses.map((a) => a.dimensions[dim]?.score ?? 5);
      dimScores[dim] = Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100) / 100;
    }
    const avgQuality = hotelAnalyses.reduce((s, a) => s + a.overall_quality_score, 0) / hotelAnalyses.length;
    return {
      customer_id: customerId,
      conversation_count: hotelAnalyses.length,
      avg_quality_score: Math.round(avgQuality * 100) / 100,
      dimension_scores: dimScores,
    };
  });

  // Issue heatmap: worker -> dimension -> count
  const heatmap: Record<string, Record<string, number>> = {};
  for (const wa of workerAttributions) {
    heatmap[wa.worker] = { ...wa.by_dimension };
  }

  return {
    meta: {
      period_start: formData.period_start,
      period_end: formData.period_end,
      generated_at: new Date().toISOString(),
      report_version: "1.0",
      total_conversations: analyses.length,
      hotel_count: hotelMap.size,
      notes: formData.notes,
    },
    overall_quality_score: Math.round(overallAvg * 100) / 100,
    dimensions,
    worker_attributions: workerAttributions,
    hotel_breakdowns: hotelBreakdowns,
    issue_heatmap: heatmap,
    proposals,
    conversation_analyses: analyses,
  };
}

export function computeDimensionAverages(analyses: ConversationQualityAnalysis[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const dim of DIMENSIONS) {
    const scores = analyses.map((a) => a.dimensions[dim]?.score ?? 5);
    result[dim] = scores.reduce((s, v) => s + v, 0) / scores.length;
  }
  return result;
}
