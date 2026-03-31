import { GoogleGenAI } from "@google/genai";
import type { GA4QueryParams } from "./ga4-client";

interface GA4MetadataSummary {
  dimensions: { apiName: string; uiName: string; description: string }[];
  metrics: { apiName: string; uiName: string; description: string }[];
}

export interface QueryBuildResult {
  query: GA4QueryParams | null;
  queryType: "report" | "funnel" | "metadata";
  explanation: string;
  funnelParams?: {
    dateRanges: { startDate: string; endDate: string }[];
    funnelSteps: { name: string; filterExpression: Record<string, unknown> }[];
  };
}

export async function buildGA4Query(
  userQuestion: string,
  metadata: GA4MetadataSummary,
  conversationHistory: { role: "user" | "assistant"; content: string }[]
): Promise<QueryBuildResult> {
  // Only include a subset of metadata to stay within token limits
  const topDimensions = metadata.dimensions.slice(0, 80);
  const topMetrics = metadata.metrics.slice(0, 80);

  const systemPrompt = `You are a Google Analytics 4 Data API expert. Your job is to translate natural language questions into GA4 Data API query parameters.

You have access to the following GA4 dimensions and metrics for this property:

DIMENSIONS (${topDimensions.length} of ${metadata.dimensions.length}):
${topDimensions.map((d) => `- ${d.apiName}: ${d.uiName} — ${d.description}`).join("\n")}

METRICS (${topMetrics.length} of ${metadata.metrics.length}):
${topMetrics.map((m) => `- ${m.apiName}: ${m.uiName} — ${m.description}`).join("\n")}

RULES:
- Respond ONLY with valid JSON matching one of the schemas below.
- Choose the right query type based on the question.
- For date ranges, use relative strings: "today", "yesterday", "7daysAgo", "30daysAgo", "90daysAgo", "365daysAgo", or "YYYY-MM-DD" format.
- Default to last 30 days if no date is mentioned.
- Use limit to cap results (default 20 for dimension breakdowns).
- If the user asks about funnels or step-by-step conversion, use "funnel" type.
- If the user asks what dimensions/metrics are available, use "metadata" type.

REPORT QUERY SCHEMA:
{
  "queryType": "report",
  "explanation": "Brief explanation of what this query does",
  "query": {
    "dateRanges": [{ "startDate": "30daysAgo", "endDate": "today" }],
    "dimensions": [{ "name": "dimensionApiName" }],
    "metrics": [{ "name": "metricApiName" }],
    "orderBys": [{ "metric": { "metricName": "metricApiName" }, "desc": true }],
    "limit": 20
  }
}

FUNNEL QUERY SCHEMA:
{
  "queryType": "funnel",
  "explanation": "Brief explanation of funnel steps",
  "funnelParams": {
    "dateRanges": [{ "startDate": "30daysAgo", "endDate": "today" }],
    "funnelSteps": [
      {
        "name": "Step name",
        "filterExpression": {
          "andGroup": {
            "expressions": [
              { "fieldName": "eventName", "stringFilter": { "value": "page_view", "matchType": "EXACT" } }
            ]
          }
        }
      }
    ]
  }
}

METADATA QUERY SCHEMA:
{
  "queryType": "metadata",
  "explanation": "Here are the available dimensions and metrics..."
}

IMPORTANT:
- Only use apiName values from the lists above. Do NOT invent dimension or metric names.
- If you're unsure which dimension/metric to use, prefer the most common ones.
- Always include at least one metric.
- The explanation should be concise (1-2 sentences) and in the same language as the user's question.`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Build conversation as a single user message with history context
  const historyText = conversationHistory
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");
  const fullMessage = historyText
    ? `Previous conversation:\n${historyText}\n\nNew question: ${userQuestion}`
    : userQuestion;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: fullMessage,
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: 2000,
      temperature: 0,
    },
  });

  const text = response.text ?? "";

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      query: null,
      queryType: "report",
      explanation: "Could not parse the query. Please try rephrasing your question.",
    };
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    query: parsed.query ?? null,
    queryType: parsed.queryType ?? "report",
    explanation: parsed.explanation ?? "",
    funnelParams: parsed.funnelParams,
  };
}

export function formatGA4Response(response: Record<string, unknown>): {
  headers: string[];
  rows: string[][];
  rowCount: number;
} {
  const dimensionHeaders = (
    (response.dimensionHeaders as { name: string }[]) ?? []
  ).map((h) => h.name);
  const metricHeaders = (
    (response.metricHeaders as { name: string }[]) ?? []
  ).map((h) => h.name);
  const headers = [...dimensionHeaders, ...metricHeaders];

  const rawRows = (response.rows as Record<string, unknown>[]) ?? [];
  const rows = rawRows.map((row) => {
    const dimValues = (
      (row.dimensionValues as { value: string }[]) ?? []
    ).map((v) => v.value);
    const metricValues = (
      (row.metricValues as { value: string }[]) ?? []
    ).map((v) => v.value);
    return [...dimValues, ...metricValues];
  });

  return { headers, rows, rowCount: rows.length };
}
