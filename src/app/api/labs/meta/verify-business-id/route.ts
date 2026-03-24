import { NextRequest, NextResponse } from "next/server";

interface BusinessDetails {
  id: string;
  name?: string;
  verification_status?: string;
  two_factor_type?: string;
  is_hidden?: boolean;
  link?: string;
  vertical?: string;
  created_time?: string;
  primary_page?: { id: string; name: string } | null;
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

const BUSINESS_FIELDS = [
  "id",
  "name",
  "verification_status",
  "two_factor_type",
  "is_hidden",
  "link",
  "vertical",
  "created_time",
  "primary_page",
].join(",");

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
    const base = `https://graph.facebook.com/v22.0/${encodeURIComponent(id)}`;
    const auth = `access_token=${encodeURIComponent(token)}`;

    // Fetch with all business fields
    const res = await fetch(`${base}?fields=${BUSINESS_FIELDS}&${auth}`);
    const data = await res.json();

    if (data.error) {
      return NextResponse.json({
        valid: false,
        type: "invalid",
        error: data.error.message || "not_found",
      } satisfies VerificationResult);
    }

    // Check if it's a page (pages have category field)
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

    // It's a Business Portfolio — return full details
    const details: BusinessDetails = {
      id: data.id,
      name: data.name,
      verification_status: data.verification_status,
      two_factor_type: data.two_factor_type,
      is_hidden: data.is_hidden,
      link: data.link,
      vertical: data.vertical,
      created_time: data.created_time,
      primary_page: data.primary_page || null,
    };

    return NextResponse.json({
      valid: true,
      type: "business",
      name: data.name,
      details,
    } satisfies VerificationResult);
  } catch {
    return NextResponse.json(
      { valid: false, type: "invalid", error: "network_error" } satisfies VerificationResult,
      { status: 502 }
    );
  }
}
