import { NextRequest, NextResponse } from "next/server";

interface BusinessDetails {
  id: string;
  name?: string;
  link?: string;
  created_time?: string;
}

interface VerificationResult {
  valid: boolean;
  type: "business" | "page" | "invalid";
  name?: string;
  category?: string;
  error?: string;
  details?: BusinessDetails;
}

const RATE_LIMIT_WINDOW = 60_000;
const MAX_REQUESTS = 30;
const requestLog: number[] = [];

function isRateLimited(): boolean {
  const now = Date.now();
  while (requestLog.length > 0 && requestLog[0] < now - RATE_LIMIT_WINDOW) {
    requestLog.shift();
  }
  if (requestLog.length >= MAX_REQUESTS) return true;
  requestLog.push(now);
  return false;
}

export async function POST(request: NextRequest) {
  if (isRateLimited()) {
    return NextResponse.json(
      { valid: false, type: "invalid", error: "rate_limit" } satisfies VerificationResult,
      { status: 429 }
    );
  }

  const token = process.env.META_APP_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { valid: false, type: "invalid", error: "token_not_configured" } satisfies VerificationResult,
      { status: 500 }
    );
  }

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { valid: false, type: "invalid", error: "invalid_body" } satisfies VerificationResult,
      { status: 400 }
    );
  }

  const id = body.id?.trim();
  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json(
      { valid: false, type: "invalid", error: "invalid_id_format" } satisfies VerificationResult,
      { status: 400 }
    );
  }

  try {
    const base = `https://graph.facebook.com/v19.0/${encodeURIComponent(id)}`;
    const auth = `access_token=${encodeURIComponent(token)}`;

    // Step 1: Basic check — does the ID exist?
    const res = await fetch(`${base}?fields=id,name&${auth}`);
    const data = await res.json();

    if (data.error) {
      return NextResponse.json({
        valid: false,
        type: "invalid",
      } satisfies VerificationResult);
    }

    // Step 2: Check if it's a Facebook Page (pages have category)
    const catRes = await fetch(`${base}?fields=id,name,category&${auth}`);
    const catData = await catRes.json();

    if (!catData.error && catData.category) {
      return NextResponse.json({
        valid: false,
        type: "page",
        name: catData.name,
        category: catData.category,
      } satisfies VerificationResult);
    }

    // Step 3: Try extended fields (optional — may fail for external businesses)
    let link: string | undefined;
    let createdTime: string | undefined;
    try {
      const extRes = await fetch(`${base}?fields=link,created_time&${auth}`);
      const extData = await extRes.json();
      if (!extData.error) {
        link = extData.link;
        createdTime = extData.created_time;
      }
    } catch {
      // Extended fields not available — that's OK
    }

    // It's a valid Business Portfolio
    return NextResponse.json({
      valid: true,
      type: "business",
      name: data.name,
      details: {
        id: data.id,
        name: data.name,
        link,
        created_time: createdTime,
      },
    } satisfies VerificationResult);
  } catch {
    return NextResponse.json(
      { valid: false, type: "invalid", error: "network_error" } satisfies VerificationResult,
      { status: 502 }
    );
  }
}
