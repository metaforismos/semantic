import { NextResponse } from "next/server";
import { runGA4Report, runGA4FunnelReport, getGA4Metadata } from "@/lib/analytics/ga4-client";
import { buildGA4Query, formatGA4Response } from "@/lib/analytics/query-builder";

export async function POST(request: Request) {
  try {
    const { question, conversationHistory } = await request.json();

    if (!question || typeof question !== "string") {
      return NextResponse.json({ error: "Question is required" }, { status: 400 });
    }

    // Get metadata for the property so the LLM knows what's available
    const metadata = await getGA4Metadata();

    // Build the query from natural language
    const queryResult = await buildGA4Query(
      question,
      metadata,
      conversationHistory ?? []
    );

    // If metadata query, return available dimensions/metrics
    if (queryResult.queryType === "metadata") {
      return NextResponse.json({
        type: "metadata",
        explanation: queryResult.explanation,
        data: {
          dimensionCount: metadata.dimensions.length,
          metricCount: metadata.metrics.length,
          sampleDimensions: metadata.dimensions.slice(0, 30),
          sampleMetrics: metadata.metrics.slice(0, 30),
        },
      });
    }

    // Execute funnel report
    if (queryResult.queryType === "funnel" && queryResult.funnelParams) {
      const response = await runGA4FunnelReport(queryResult.funnelParams);
      return NextResponse.json({
        type: "funnel",
        explanation: queryResult.explanation,
        funnelSteps: queryResult.funnelParams.funnelSteps.map((s) => s.name),
        data: response,
      });
    }

    // Execute standard report
    if (!queryResult.query) {
      return NextResponse.json({
        type: "error",
        explanation: queryResult.explanation,
      });
    }

    // Sanitize: remove dimensions that are actually metric names (LLM occasionally confuses them)
    const metricNames = new Set(metadata.metrics.map((m) => m.apiName));
    if (queryResult.query.dimensions) {
      queryResult.query.dimensions = queryResult.query.dimensions.filter(
        (d) => !metricNames.has(d.name)
      );
      if (queryResult.query.dimensions.length === 0) {
        delete queryResult.query.dimensions;
      }
    }

    const response = await runGA4Report(queryResult.query);
    const formatted = formatGA4Response(response as unknown as Record<string, unknown>);

    return NextResponse.json({
      type: "report",
      explanation: queryResult.explanation,
      query: queryResult.query,
      data: formatted,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Analytics query error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
