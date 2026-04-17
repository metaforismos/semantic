import { NextRequest, NextResponse } from "next/server";
import { analyzeUrl } from "@/lib/tracker/analyze";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let body: {
    url?: string;
    save?: boolean;
    hotel_id?: string;
    prefill?: {
      external_id?: string;
      canonical_name?: string;
      country?: string;
      region?: string;
      city?: string;
      is_customer?: boolean;
    };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  if (!body.url) {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }

  const result = await analyzeUrl({
    url: body.url,
    save: body.save,
    hotel_id: body.hotel_id ?? null,
    prefill: body.prefill,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 502 });
  }

  return NextResponse.json(result);
}
