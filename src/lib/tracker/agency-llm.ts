// LLM-based agency extractor. Used as a Tier-4 fallback when the
// deterministic regex in agency.ts returns null. Passes a trimmed slice
// of the site HTML (bottom third, stripped of scripts/styles) to an LLM
// and asks for {agency_name, agency_url} | null.
//
// Confidence from the LLM path is capped at 0.6 so a T1/T2/T3 rule hit
// always wins. This module does NOT replace the deterministic detector
// — it complements it, and only runs when the cheap path fails.

import { callLLM } from "../llm";
import type { AgencyInfo } from "./types";

// Known platform hosts — mirror of PLATFORM_HOSTS in agency.ts. Kept
// duplicated (small list) so the LLM module is self-contained.
const PLATFORM_HOSTS = new Set([
  "siteminder.com",
  "cloudbeds.com",
  "mews.com",
  "profitroom.com",
  "profitroom.pl",
  "hotetec.com",
  "d-edge.com",
  "availpro.com",
  "synxis.com",
  "ihotelier.com",
  "travelclick.com",
  "amadeus-hospitality.com",
  "sabrehospitality.com",
  "littlehotelier.com",
  "guestline.com",
  "hotelrunner.com",
  "omnibees.com",
  "roomcloud.net",
  "asksuite.com",
  "bookingcore.com",
  "wordpress.com",
  "wordpress.org",
  "wix.com",
  "squarespace.com",
  "webflow.com",
  "shopify.com",
  "blogger.com",
  "blogspot.com",
  "google.com",
  "litespeedtech.com",
  "litespeed.com",
  "godaddy.com",
  "wpengine.com",
  "tambourine.com",
  "tambo.site",
  "cryoutcreations.eu",
  "blossomthemes.com",
  "elegantthemes.com",
  "themeforest.net",
  "themeisle.com",
  "themegrill.com",
  "template-monster.com",
  "templatemonster.com",
  "colorlib.com",
  "envato.com",
  "html5up.net",
  "styleshout.com",
  "freehtml5.co",
  "bootstrapmade.com",
  "w3layouts.com",
  "start-bootstrap.com",
]);

function hostIsPlatform(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  if (PLATFORM_HOSTS.has(host)) return true;
  for (const p of PLATFORM_HOSTS) {
    if (host.endsWith("." + p)) return true;
  }
  return false;
}

// Trim HTML to just the footer-ish region and strip noisy tags so the
// LLM sees a focused candidate instead of 300 KB of WPBakery markup.
//
// Strategy: start from the full HTML, strip script/style/comments and
// collapse whitespace, then return the LAST 14 KB. The agency credit is
// typically the final visible sentence of the page ("designed by X",
// "© 2024 Hotel … — Developed by Y"), so the end of the cleaned HTML is
// where we need to focus.
function prepareFooterSlice(html: string): string {
  const cleaned = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // If the cleaned HTML has an explicit <footer>, start from there.
  // Otherwise just take the last 14 KB, which reliably contains the
  // footer for both classic and WPBakery-style layouts.
  const footerStart = cleaned.toLowerCase().lastIndexOf("<footer");
  if (footerStart >= 0) {
    return cleaned.slice(footerStart).slice(0, 14_000);
  }
  return cleaned.slice(-14_000);
}

const SYSTEM_PROMPT = `You identify the web design agency that built a hotel website, based on the footer HTML.

Rules:
- Return the agency ONLY if the footer credits a third-party web design / development / digital agency that BUILT or DESIGNED the site.
- Typical phrasings: "designed by X", "developed by X", "site by X", "created by X", "web design: X", "diseño web: X", "desarrollado por X", "powered by X" (only when X is an agency, not a platform).
- Do NOT return platforms, CMSes, or booking engines: WordPress, Wix, Squarespace, Webflow, Blogger, Shopify, Cloudbeds, SiteMinder, Mews, Profitroom, Synxis, D-Edge, Hotetec, Little Hotelier, Guestline, Asksuite, Omnibees, TravelClick, RoomCloud, LiteSpeed, GoDaddy, WP Engine, etc.
- Do NOT return the hotel itself or hotel chain names.
- Do NOT return social media handles or OTAs (Booking, Expedia, TripAdvisor, Airbnb).
- If the footer does not clearly credit an agency, return null.

Respond with JSON only, no prose. Format:
  {"agency_name": "<name>", "agency_url": "<full URL or null>"}
Or:
  {"agency_name": null, "agency_url": null}`;

type LlmAgencyResult = {
  agency_name: string | null;
  agency_url: string | null;
};

function parseLlmJson(text: string): LlmAgencyResult | null {
  // LLMs sometimes wrap JSON in ```json blocks or add prose. Extract
  // the first {...} balanced block.
  const match = text.match(/\{[\s\S]*?\}/);
  if (!match) return null;
  try {
    const j = JSON.parse(match[0]);
    return {
      agency_name:
        typeof j.agency_name === "string" && j.agency_name.trim()
          ? j.agency_name.trim().slice(0, 80)
          : null,
      agency_url:
        typeof j.agency_url === "string" && j.agency_url.trim()
          ? j.agency_url.trim()
          : null,
    };
  } catch {
    return null;
  }
}

export type LlmAgencyOpts = {
  // Primary model to try. Uses the shared callLLM fallback chain, so
  // whichever provider has an API key configured will be used.
  // Default: "gemini-flash" (~3× cheaper than claude-haiku on input and
  // empirically equivalent quality on footer extraction; fallback chain
  // in llm.ts handles outages).
  modelId?: string;
};

// Cheap pre-filter: if the footer slice has no agency-signal trigger word
// at all, we skip the LLM call entirely. Saves ~30-40% of calls at near
// zero precision loss (if there's no phrase, the LLM couldn't extract an
// agency anyway). Keep the list broad enough to not drop edge cases.
const AGENCY_TRIGGER_PATTERN =
  /\b(design(?:ed)?|develop(?:ed|ment)?|powered|created|crafted|site\s+by|made\s+by|built\s+by|dise[ñn]ad[oa]|desarrollad[oa]|creado|hecho\s+por|realizad[oa]|web\s+design|desarrollo\s+web|agencia|agency|studio|estudio)\b/i;

export async function detectAgencyWithLlm(
  html: string,
  baseHost: string,
  opts: LlmAgencyOpts = {}
): Promise<AgencyInfo | null> {
  // Need at least one provider configured. callLLM handles the fallback
  // chain internally — we just need one key available.
  if (
    !process.env.ANTHROPIC_API_KEY &&
    !process.env.GEMINI_API_KEY &&
    !process.env.OPENAI_API_KEY
  ) {
    return null;
  }

  const slice = prepareFooterSlice(html);
  if (slice.length < 100) return null;

  // Pre-filter: if the slice has no trigger word we'd recognize, skip
  // the LLM call. ~30-40% cost cut, negligible recall loss. The regex
  // in the deterministic detector wouldn't have found anything either,
  // so this does not mask the LLM's contribution.
  if (!AGENCY_TRIGGER_PATTERN.test(slice)) return null;

  let text: string;
  try {
    const res = await callLLM({
      modelId: opts.modelId ?? "gemini-flash",
      systemPrompt: SYSTEM_PROMPT,
      userMessage: slice,
      maxTokens: 400,
    });
    text = res.text;
  } catch {
    return null;
  }

  const parsed = parseLlmJson(text);
  if (!parsed || !parsed.agency_name) return null;

  // If the LLM returned a URL, validate against platform blacklist and
  // self-host. If it points to a known platform, discard as false positive.
  let validatedUrl: string | null = null;
  if (parsed.agency_url) {
    try {
      const u = new URL(
        parsed.agency_url.startsWith("http")
          ? parsed.agency_url
          : `https://${parsed.agency_url}`
      );
      if (u.hostname === baseHost) {
        // Self-link — not an agency.
        return null;
      }
      if (hostIsPlatform(u.hostname)) {
        // Platform link — not an agency.
        return null;
      }
      if (
        /facebook|instagram|twitter|linkedin|tiktok|youtube|pinterest/i.test(
          u.hostname
        )
      ) {
        return null;
      }
      validatedUrl = u.toString();
    } catch {
      validatedUrl = null;
    }
  }

  return {
    name: parsed.agency_name,
    url: validatedUrl,
    phrase: `llm:${parsed.agency_name}`,
    // Capped at 0.6 — always beaten by rule-based T1/T2/T3 detections.
    confidence: 0.6,
  };
}
