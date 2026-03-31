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

export async function runGA4Report(params: GA4QueryParams) {
  const analyticsClient = getClient();
  const propertyId = getPropertyId();

  const [response] = await analyticsClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: params.dateRanges,
    dimensions: params.dimensions,
    metrics: params.metrics,
    dimensionFilter: params.dimensionFilter,
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
