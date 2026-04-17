export type DetectionCategory =
  | "cms"
  | "booking_engine"
  | "pms"
  | "channel_mgr"
  | "analytics"
  | "chat"
  | "reviews"
  | "ads"
  | "other";

export type SignatureType =
  | "script_src"
  | "iframe_src"
  | "link_href"
  | "meta_generator"
  | "html";

export type Signature = {
  type: SignatureType;
  pattern: string;
};

export type Rule = {
  id: string;
  vendor: string;
  product: string;
  category: DetectionCategory;
  confidence_base: number;
  signatures: Signature[];
};

// Evidence tiers — stable vocabulary for *how certain* a detection is.
// Ordered from strongest to weakest evidence. A single category can have
// multiple detections across tiers; synthesizeStack picks the strongest.
//
//   1 — explicit declaration: <meta generator>, HTTP x-powered-by headers
//   2 — structural fingerprint: script/iframe/link src on vendor domain
//   3 — contextual pattern: regex in HTML body (wp-emoji-release, __NEXT_DATA__)
//   4 — resource observation: external domain classified by rule or LLM
//   5 — cross-category inference: e.g. BE=Cloudbeds ⇒ PMS=Cloudbeds (low conf)
//   6 — external enrichment: Google Places, human feedback, etc.
export type EvidenceTier = 1 | 2 | 3 | 4 | 5 | 6;

export type Detection = {
  rule_id: string;
  vendor: string;
  product: string;
  category: DetectionCategory;
  confidence: number;
  tier: EvidenceTier;
  detected_via:
    | "rule"
    | "wappalyzer"
    | "llm"
    | "manual"
    | "self_hosted"
    | "inferred"
    | "external";
  evidence: {
    signature_type: SignatureType | "form_action" | "internal_anchor" | "url_extension";
    pattern: string;
    matched: string;
  }[];
};

export type AgencyInfo = {
  name: string;
  url: string | null;
  phrase: string;
  confidence: number;
};

export type SelfHostedSignal = {
  kind: "form" | "internal_anchor" | "extension";
  evidence: string;
  label: string; // "Custom / self-hosted", "Custom (PHP)", etc.
};

export type ResourceRole =
  | "booking_engine"
  | "cms"
  | "analytics"
  | "chat"
  | "reviews"
  | "ads"
  | "cdn"
  | "fonts"
  | "maps"
  | "video"
  | "social"
  | "pms"
  | "channel_mgr"
  | "ota"
  | "consent"
  | "other"
  | "unknown";

export type ResourceContext = {
  type: SignatureType | "anchor_href" | "form_action";
  url: string;
  snippet?: string;
};

export type RawResource = {
  host: string;
  registrable_domain: string;
  role_hint: ResourceRole;
  vendor_name?: string | null;
  vendor_product?: string | null;
  classified_by?: "rule" | null;
  contexts: ResourceContext[];
};

export type ChainInfo = {
  is_chain: boolean;
  property_count_estimate: number | null;
  signals: string[];
};

export type AnalyzeResult = {
  url: string;
  final_url: string;
  status: number;
  fetched_at: string;
  duration_ms: number;
  title: string | null;
  meta_generator: string | null;
  detections: Detection[];
  resources: RawResource[];
  chain: ChainInfo;
  agency: AgencyInfo | null;
  self_hosted_booking: SelfHostedSignal | null;
  self_hosted_cms: SelfHostedSignal | null;
  // Surfaced structural data
  script_srcs: string[];
  iframe_srcs: string[];
  link_hrefs: string[];
  outbound_links: string[];
};
