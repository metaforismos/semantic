import type { Conversation, InteractionByOrigin } from "./types";

function isValidPhone(value: string): boolean {
  if (!value || !value.trim()) return false;
  const cleaned = value.replace(/[\s\-\(\)\+]/g, "");
  return /^\d{7,15}$/.test(cleaned);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function calcValidDataRate(conversations: Conversation[]): number {
  if (conversations.length === 0) return 0;
  const uniqueLines = new Set(conversations.map((c) => c.external_line));
  const validCount = [...uniqueLines].filter(isValidPhone).length;
  return validCount / uniqueLines.size;
}

export function calcInteractionRate(conversations: Conversation[]): {
  overall: number;
  contacted: number;
  responded: number;
} {
  // Only conversations that have at least one Campaign or Survey
  const contacted = conversations.filter((c) =>
    c.messages.some((m) => m.message_type === "Campaign" || m.message_type === "Survey")
  );
  const responded = contacted.filter((c) => c.is_active);

  return {
    overall: contacted.length > 0 ? responded.length / contacted.length : 0,
    contacted: contacted.length,
    responded: responded.length,
  };
}

export function calcInteractionByOrigin(conversations: Conversation[]): InteractionByOrigin[] {
  const originMap = new Map<string, { contacted: number; responded: number }>();

  for (const conv of conversations) {
    const hasCampaign = conv.messages.some(
      (m) => m.message_type === "Campaign" || m.message_type === "Survey"
    );
    if (!hasCampaign) continue;

    const origin = conv.origin;
    const entry = originMap.get(origin) || { contacted: 0, responded: 0 };
    entry.contacted++;
    if (conv.is_active) entry.responded++;
    originMap.set(origin, entry);
  }

  return [...originMap.entries()]
    .map(([origin, data]) => ({
      origin,
      rate: data.contacted > 0 ? data.responded / data.contacted : 0,
      responded: data.responded,
      contacted: data.contacted,
    }))
    .sort((a, b) => b.rate - a.rate);
}

export function calcResponseTime(conversations: Conversation[]): {
  bot_median_seconds: number;
  human_benchmark_minutes: number;
} {
  const responseTimes: number[] = [];

  for (const conv of conversations) {
    const msgs = conv.messages;
    for (let i = 1; i < msgs.length; i++) {
      if (msgs[i].message_type === "IA" && msgs[i - 1].message_type === "Human") {
        const diffMs = msgs[i].sent_at.getTime() - msgs[i - 1].sent_at.getTime();
        if (diffMs > 0 && diffMs < 3600000) {
          // Exclude > 1 hour as outliers
          responseTimes.push(diffMs / 1000);
        }
      }
    }
  }

  return {
    bot_median_seconds: Math.round(median(responseTimes)),
    human_benchmark_minutes: 12,
  };
}

export function calcTimeSaved(
  totalIAMessages: number,
  botMedianSeconds: number,
  humanBenchmarkMinutes: number = 12
): {
  hours: number;
  equivalent_manual_tasks: number;
  equivalent_task_label: string;
  human_benchmark_minutes: number;
} {
  const humanSeconds = humanBenchmarkMinutes * 60;
  const savedSecondsPerMessage = Math.max(0, humanSeconds - botMedianSeconds);
  const totalSavedSeconds = totalIAMessages * savedSecondsPerMessage;
  const hours = Math.round((totalSavedSeconds / 3600) * 10) / 10;

  return {
    hours,
    equivalent_manual_tasks: totalIAMessages,
    equivalent_task_label: "Respuestas manuales equivalentes",
    human_benchmark_minutes: humanBenchmarkMinutes,
  };
}
