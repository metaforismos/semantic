import { BetaAnalyticsDataClient } from "@google-analytics/data";

let client: BetaAnalyticsDataClient | null = null;

function getClient(): BetaAnalyticsDataClient {
  if (client) return client;

  const credentialsJson = process.env.GA4_SERVICE_ACCOUNT_JSON;
  if (!credentialsJson) {
    throw new Error("GA4_SERVICE_ACCOUNT_JSON env var is not set");
  }

  const credentials = JSON.parse(credentialsJson);
  client = new BetaAnalyticsDataClient({ credentials });
  return client;
}

export function getPropertyId(): string {
  const id = process.env.GA4_PROPERTY_ID;
  if (!id) throw new Error("GA4_PROPERTY_ID env var is not set");
  return id;
}

export interface GA4QueryParams {
  dateRanges: { startDate: string; endDate: string }[];
  dimensions?: { name: string }[];
  metrics: { name: string }[];
  dimensionFilter?: Record<string, unknown>;
  orderBys?: Record<string, unknown>[];
  limit?: number;
}

// Validate that a dimensionFilter has the structure GA4 API expects.
// A valid filter node must have exactly one of: filter, andGroup, orGroup, notExpression.
// If the LLM produces something invalid, we drop it to avoid API errors.
function sanitizeFilter(f: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!f || typeof f !== "object") return undefined;

  // Valid single filter: { filter: { fieldName, stringFilter|inListFilter|numericFilter|betweenFilter } }
  if (f.filter && typeof f.filter === "object") {
    const filter = f.filter as Record<string, unknown>;
    if (!filter.fieldName) return undefined;
    if (filter.stringFilter || filter.inListFilter || filter.numericFilter || filter.betweenFilter) {
      return { filter: f.filter };
    }
    return undefined;
  }

  // Valid group: { andGroup: { expressions: [...] } } or { orGroup: { expressions: [...] } }
  for (const groupKey of ["andGroup", "orGroup"] as const) {
    if (f[groupKey] && typeof f[groupKey] === "object") {
      const group = f[groupKey] as Record<string, unknown>;
      if (Array.isArray(group.expressions) && group.expressions.length > 0) {
        const validExpressions = group.expressions
          .map((expr: unknown) => sanitizeFilter(expr as Record<string, unknown>))
          .filter(Boolean);
        if (validExpressions.length > 0) {
          return { [groupKey]: { expressions: validExpressions } };
        }
      }
      return undefined;
    }
  }

  // Valid not: { notExpression: { ... } }
  if (f.notExpression && typeof f.notExpression === "object") {
    const inner = sanitizeFilter(f.notExpression as Record<string, unknown>);
    return inner ? { notExpression: inner } : undefined;
  }

  return undefined;
}

export async function runGA4Report(params: GA4QueryParams) {
  const analyticsClient = getClient();
  const propertyId = getPropertyId();

  const dimensionFilter = sanitizeFilter(params.dimensionFilter);

  const [response] = await analyticsClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: params.dateRanges,
    dimensions: params.dimensions,
    metrics: params.metrics,
    ...(dimensionFilter ? { dimensionFilter } : {}),
    orderBys: params.orderBys,
    limit: params.limit ?? 100,
  });

  return response;
}

// Funnel reports use the Alpha client which may not be available.
// For the POC, we simulate funnels using sequential standard reports.
export async function runGA4FunnelReport(params: {
  dateRanges: { startDate: string; endDate: string }[];
  funnelSteps: { name: string; filterExpression: Record<string, unknown> }[];
}) {
  // Run a standard report with eventName dimension to approximate funnel
  const analyticsClient = getClient();
  const propertyId = getPropertyId();

  const [response] = await analyticsClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: params.dateRanges,
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }, { name: "totalUsers" }],
    limit: 50,
  });

  return response;
}

export async function getGA4Metadata() {
  const analyticsClient = getClient();
  const propertyId = getPropertyId();

  const [response] = await analyticsClient.getMetadata({
    name: `properties/${propertyId}/metadata`,
  });

  return {
    dimensions: response.dimensions?.map((d) => ({
      apiName: d.apiName ?? "",
      uiName: d.uiName ?? "",
      description: d.description ?? "",
      category: d.category ?? "",
    })) ?? [],
    metrics: response.metrics?.map((m) => ({
      apiName: m.apiName ?? "",
      uiName: m.uiName ?? "",
      description: m.description ?? "",
      category: m.category ?? "",
      type: m.type ?? "",
    })) ?? [],
  };
}
