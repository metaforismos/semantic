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

export type Detection = {
  rule_id: string;
  vendor: string;
  product: string;
  category: DetectionCategory;
  confidence: number;
  detected_via: "rule" | "wappalyzer" | "llm" | "manual";
  evidence: {
    signature_type: SignatureType;
    pattern: string;
    matched: string;
  }[];
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
  // Surfaced structural data used later (Fase 1C for OTA, 1B for agency)
  script_srcs: string[];
  iframe_srcs: string[];
  link_hrefs: string[];
  outbound_links: string[];
};
