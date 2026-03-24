import type {
  Conversation,
  ConversationAnalysis,
  PilotReportData,
  DerivationReason,
  TopicCount,
  SuccessCase,
  ImprovementOpportunity,
  UploadFormData,
} from "./types";
import {
  calcValidDataRate,
  calcInteractionRate,
  calcInteractionByOrigin,
  calcResponseTime,
  calcTimeSaved,
} from "./metrics";

export function aggregateReport(
  conversations: Conversation[],
  analyses: ConversationAnalysis[],
  formData: UploadFormData,
  customerId: number,
  customerName: string
): PilotReportData {
  const activeConversations = conversations.filter((c) => c.is_active);

  // Build analysis lookup
  const analysisMap = new Map<string, ConversationAnalysis>();
  for (const a of analyses) {
    analysisMap.set(a.conversation_id, a);
  }

  // Count IA messages directly from CSV (ground truth)
  const csvIAMessageCount = conversations.reduce(
    (acc, c) => acc + c.messages.filter((m) => m.message_type === "IA").length,
    0
  );

  // Quantitative metrics
  const validDataRate = calcValidDataRate(conversations);
  const interactionRate = calcInteractionRate(conversations);
  const interactionByOrigin = calcInteractionByOrigin(conversations);
  const responseTime = calcResponseTime(activeConversations);

  // LLM-derived metrics
  // Automation rate (per IA message)
  let llmIAMessages = 0;
  let derivedMessages = 0;
  const derivationReasons = new Map<string, number>();

  for (const analysis of analyses) {
    for (const iaMsg of analysis.ia_messages) {
      llmIAMessages++;
      if (iaMsg.derived) {
        derivedMessages++;
        const reason = iaMsg.derivation_reason || "Sin especificar";
        derivationReasons.set(reason, (derivationReasons.get(reason) || 0) + 1);
      }
    }
  }

  // Use LLM count if available, otherwise fall back to CSV count
  const totalIAMessages = llmIAMessages > 0 ? llmIAMessages : csvIAMessageCount;
  const notDerived = totalIAMessages - derivedMessages;
  const automationRate = totalIAMessages > 0 ? notDerived / totalIAMessages : 1;

  // Top derivation reasons
  const topReasons: DerivationReason[] = [...derivationReasons.entries()]
    .map(([reason, count]) => ({
      reason,
      count,
      pct: derivedMessages > 0 ? count / derivedMessages : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Satisfaction distribution
  const distribution: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  for (const a of analyses) {
    const key = String(Math.min(5, Math.max(1, a.satisfaction_score)));
    distribution[key] = (distribution[key] || 0) + 1;
  }
  const totalWithSatisfaction = analyses.length;
  const positiveCount = (distribution["4"] || 0) + (distribution["5"] || 0);
  const positiveRate = totalWithSatisfaction > 0 ? positiveCount / totalWithSatisfaction : 0;

  // Top topics
  const topicCounts = new Map<string, number>();
  for (const a of analyses) {
    for (const topic of a.topics) {
      topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
    }
  }
  const totalTopicMentions = [...topicCounts.values()].reduce((a, b) => a + b, 0);
  const topTopics: TopicCount[] = [...topicCounts.entries()]
    .map(([topic, count]) => ({
      topic,
      count,
      pct: totalTopicMentions > 0 ? count / totalTopicMentions : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Success cases
  const successCases: SuccessCase[] = analyses
    .filter((a) => a.is_success_case)
    .sort((a, b) => b.satisfaction_score - a.satisfaction_score)
    .slice(0, 5)
    .map((a) => ({
      conversation_id: a.conversation_id,
      summary: a.success_summary,
      satisfaction_score: a.satisfaction_score,
      topics: a.topics,
      url: `https://fidelity.myhotel.cl/concierge/conversations?conversationId=${a.conversation_id}&customer_id=${customerId}`,
    }));

  // Time saved
  const timeSaved = calcTimeSaved(
    totalIAMessages,
    responseTime.bot_median_seconds,
    responseTime.human_benchmark_minutes
  );

  // Improvement opportunities
  const improvements: ImprovementOpportunity[] = [];

  // From derivation reasons → knowledge base gaps
  for (const reason of topReasons.slice(0, 3)) {
    improvements.push({
      area: "Base de conocimiento",
      detail: `Completar información relacionada con: "${reason.reason}" para reducir derivaciones.`,
      owner: "hotel",
      impact: `Podría resolver ~${Math.round(reason.pct * 100)}% de las derivaciones actuales.`,
    });
  }

  // Low interaction origins
  for (const origin of interactionByOrigin) {
    if (origin.rate < 0.15 && origin.contacted >= 10) {
      improvements.push({
        area: "Mensaje de campaña",
        detail: `Optimizar mensaje de campaña "${origin.origin}" (tasa de interacción: ${Math.round(origin.rate * 100)}%).`,
        owner: "myhotel",
        impact: "Mayor engagement podría aumentar conversaciones activas.",
      });
    }
  }

  // Roadmap items if automation < 90%
  if (automationRate < 0.9) {
    improvements.push({
      area: "Roadmap 2026",
      detail: "Integración con PMS para consultas de habitación en tiempo real, eliminando la necesidad de derivar a recepción.",
      owner: "myhotel",
      impact: "Podría resolver un porcentaje significativo de las derivaciones actuales.",
    });
  }

  return {
    meta: {
      hotel_name: customerName,
      hotel_id: customerId,
      period_start: formData.period_start,
      period_end: formData.period_end,
      tone: "positive",
      generated_at: new Date().toISOString(),
      report_version: "1.0",
      total_conversations: conversations.length,
      active_conversations: activeConversations.length,
      concierge_name: formData.concierge_name || "Concierge",
      notes: formData.notes,
    },
    metrics: {
      valid_data_rate: {
        phone: Math.round(validDataRate * 100) / 100,
        note: "Email no disponible en CSV. Solo se evalúa teléfono.",
      },
      interaction_rate: {
        overall: Math.round(interactionRate.overall * 100) / 100,
        contacted: interactionRate.contacted,
        responded: interactionRate.responded,
      },
      interaction_by_origin: interactionByOrigin,
      automation_rate: {
        rate: Math.round(automationRate * 100) / 100,
        not_derived: notDerived,
        derived: derivedMessages,
        total_ia_messages: totalIAMessages,
        label: "mensajes del concierge que se resolvieron sin derivar a un ser humano",
      },
      derivation_rate: {
        rate: Math.round((1 - automationRate) * 100) / 100,
        top_reasons: topReasons,
      },
      time_saved: timeSaved,
      response_time: responseTime,
      inferred_satisfaction: {
        distribution,
        positive_rate: Math.round(positiveRate * 100) / 100,
        positive_label: "% de huéspedes con satisfacción 4 o 5",
      },
      top_topics: topTopics,
    },
    success_cases: successCases,
    improvement_opportunities: improvements,
  };
}
