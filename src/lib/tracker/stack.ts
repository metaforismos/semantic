import type { Detection, EvidenceTier, RawResource } from "./types";

// Categorías que queremos representar SIEMPRE en el stack sintetizado por hotel.
// Un hotel sin ninguna señal para la categoría queda con value=null (fila vacía).
export const STACK_CATEGORIES = [
  "booking_engine",
  "cms",
  "pms",
  "channel_mgr",
  "chat",
  "reviews",
  "ads",
  "analytics",
  "consent",
] as const;

export type StackCategory = (typeof STACK_CATEGORIES)[number];

export type StackCell = {
  vendor: string | null;
  product: string | null;
  // Dominio que mejor representa la categoría (útil cuando no hay vendor aún).
  domain: string | null;
  source:
    | "rule"
    | "resource"
    | "inferred"
    | "external"
    | null;
  // Evidence tier 1..6 (1 = strongest, 6 = weakest). See types.ts.
  tier: EvidenceTier | null;
  confidence: number | null;
  needs_classification: boolean;
};

export type SynthesizedStack = Record<StackCategory, StackCell | null>;

function emptyCell(): StackCell {
  return {
    vendor: null,
    product: null,
    domain: null,
    source: null,
    tier: null,
    confidence: null,
    needs_classification: false,
  };
}

function fromDetection(d: Detection): StackCell {
  // Map detected_via to our StackCell.source. Inference and external
  // signals keep their distinct sources so the UI can badge them.
  const source: StackCell["source"] =
    d.detected_via === "inferred"
      ? "inferred"
      : d.detected_via === "external"
      ? "external"
      : "rule";
  return {
    vendor: d.vendor,
    product: d.product,
    domain: null,
    source,
    tier: d.tier,
    confidence: d.confidence,
    needs_classification: false,
  };
}

function fromResource(r: RawResource): StackCell {
  return {
    vendor: r.vendor_name || null,
    product: r.vendor_product || null,
    domain: r.registrable_domain,
    source: "resource",
    tier: 4,
    confidence: r.classified_by === "rule" ? 0.8 : null,
    needs_classification: !r.vendor_name,
  };
}

// Cross-category inference table. When the booking engine vendor is an
// integrated all-in-one (same company sells PMS + BE), we can infer the
// PMS even without direct evidence. Confidence is low (0.4, tier 5) so
// that any direct PMS detection upstream would always override this.
//
// Only vendors where the company sells BOTH products in practice in LATAM.
// Channel-manager-only (SiteMinder Booking Button, D-Edge, Synxis, TravelClick,
// Pegasus, Omnibees) do NOT get PMS inference — those are CRS/CM layers
// typically paired with an external PMS we can't guess.
const BE_TO_PMS_INFERENCE: Record<
  string,
  { vendor: string; product: string }
> = {
  Cloudbeds: { vendor: "Cloudbeds", product: "Cloudbeds PMS (inferred)" },
  Mews: { vendor: "Mews", product: "Mews PMS (inferred)" },
  "Little Hotelier": {
    vendor: "Little Hotelier",
    product: "Little Hotelier PMS (inferred)",
  },
  Profitroom: {
    vendor: "Profitroom",
    product: "Profitroom PMS (inferred)",
  },
  Hotetec: { vendor: "Hotetec", product: "Hotetec PMS (inferred)" },
  Guestline: {
    vendor: "Guestline",
    product: "Guestline PMS (inferred)",
  },
  "Oracle Hospitality": {
    vendor: "Oracle Hospitality",
    product: "OPERA PMS (inferred)",
  },
};

/**
 * Compone un stack por categoría priorizando:
 *  1. Detection por regla (máxima confianza, rule-matched vendor).
 *  2. Recurso observado con role_hint = categoría (de discovery).
 *     - Si tiene vendor_name (de rule o LLM): lo usa.
 *     - Si no: usa el dominio crudo y marca needs_classification=true.
 *  3. Inferencia cruzada (tier 5): p.ej. BE vendor ⇒ PMS vendor para
 *     vendors integrados all-in-one. Sólo llena categorías vacías.
 *
 * Devuelve null cuando no hay señal de ningún tipo para esa categoría.
 */
export function synthesizeStack(
  detections: Detection[],
  resources: RawResource[]
): SynthesizedStack {
  const out = {} as SynthesizedStack;

  for (const cat of STACK_CATEGORIES) {
    out[cat] = null;
  }

  // Pasada 1: detecciones por regla (preferidas si existen).
  for (const cat of STACK_CATEGORIES) {
    const det = detections
      .filter((d) => d.category === cat)
      .sort((a, b) => {
        // Lower tier wins; within tier, higher confidence wins.
        if (a.tier !== b.tier) return a.tier - b.tier;
        return b.confidence - a.confidence;
      })[0];
    if (det) out[cat] = fromDetection(det);
  }

  // Pasada 2: llenar categorías vacías con el mejor recurso observado.
  // Preferimos recursos con vendor_name (ya clasificados) sobre "sin clasificar".
  for (const cat of STACK_CATEGORIES) {
    if (out[cat]) continue;
    const matching = resources.filter((r) => r.role_hint === cat);
    if (matching.length === 0) continue;
    const classified = matching.find((r) => r.vendor_name);
    out[cat] = fromResource(classified ?? matching[0]);
  }

  // Pasada 3 (tier 5): inferencia cruzada. Solo llena PMS si:
  //  - aún no hay señal directa, Y
  //  - hay un booking_engine vendor que conocemos como all-in-one.
  if (!out.pms && out.booking_engine?.vendor) {
    const inf = BE_TO_PMS_INFERENCE[out.booking_engine.vendor];
    if (inf) {
      out.pms = {
        vendor: inf.vendor,
        product: inf.product,
        domain: null,
        source: "inferred",
        tier: 5,
        confidence: 0.4,
        needs_classification: false,
      };
    }
  }

  // Asegura objeto completo con null explícito para categorías vacías.
  for (const cat of STACK_CATEGORIES) {
    if (!out[cat]) out[cat] = emptyCell();
  }

  return out;
}

/**
 * Resumen compacto del stack, seguro para serializar en bulk result_summary
 * y para mostrar como pills en la tabla del job.
 *
 * Expone vendor + tier + confidence por categoría. La UI puede decidir
 * mostrar "Cloudbeds · T2 · 0.9" vs "Cloudbeds · T5 · 0.4 (inferido)".
 */
export type CompactCategoryCell = {
  vendor: string | null;
  tier: EvidenceTier | null;
  confidence: number | null;
  source: StackCell["source"];
};

export function compactStackSummary(stack: SynthesizedStack): {
  categories: string[];
  booking_engine: string | null;
  cms: string | null;
  pms: string | null;
  chat: string | null;
  reviews: string | null;
  ads: string | null;
  analytics: string | null;
  // Per-category tier + confidence for UI badges and downstream tiering.
  cells: Record<StackCategory, CompactCategoryCell>;
} {
  const label = (c: StackCell | null) =>
    c && (c.vendor || c.domain) ? c.vendor || c.domain : null;
  const cats = STACK_CATEGORIES.filter((k) => !!(stack[k]?.source ?? null));

  const cells = {} as Record<StackCategory, CompactCategoryCell>;
  for (const cat of STACK_CATEGORIES) {
    const c = stack[cat];
    cells[cat] = {
      vendor: c?.vendor ?? null,
      tier: c?.tier ?? null,
      confidence: c?.confidence ?? null,
      source: c?.source ?? null,
    };
  }

  return {
    categories: cats,
    booking_engine: label(stack.booking_engine),
    cms: label(stack.cms),
    pms: label(stack.pms),
    chat: label(stack.chat),
    reviews: label(stack.reviews),
    ads: label(stack.ads),
    analytics: label(stack.analytics),
    cells,
  };
}
