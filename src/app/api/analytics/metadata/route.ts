import { NextResponse } from "next/server";
import { getGA4Metadata } from "@/lib/analytics/ga4-client";

export async function GET() {
  try {
    const metadata = await getGA4Metadata();
    return NextResponse.json({
      connected: true,
      propertyId: process.env.GA4_PROPERTY_ID,
      dimensionCount: metadata.dimensions.length,
      metricCount: metadata.metrics.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ connected: false, error: message }, { status: 200 });
  }
}
