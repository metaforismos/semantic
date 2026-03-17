import { NextRequest, NextResponse } from "next/server";

interface VerificationResult {
  valid: boolean;
  type: "business" | "page" | "invalid";
  name?: string;
  category?: string;
  error?: string;
}

const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const MAX_REQUESTS = 30;
const requestLog: number[] = [];

function isRateLimited(): boolean {
  const now = Date.now();
  // Remove entries older than the window
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

    // Step 1: Check if the ID exists at all
    const res = await fetch(`${base}?fields=id,name&${auth}`);
    const data = await res.json();

    if (data.error) {
      return NextResponse.json({
        valid: false,
        type: "invalid",
      } satisfies VerificationResult);
    }

    // Step 2: Try to fetch category — pages have it, business portfolios don't
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

    // No category field → Business Portfolio ID
    return NextResponse.json({
      valid: true,
      type: "business",
      name: data.name,
    } satisfies VerificationResult);
  } catch {
    return NextResponse.json(
      { valid: false, type: "invalid", error: "network_error" } satisfies VerificationResult,
      { status: 502 }
    );
  }
}
