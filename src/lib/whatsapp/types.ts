export type TemplateLang = "es" | "en" | "pt";
export type ButtonType = "URL" | "PHONE_NUMBER" | "QUICK_REPLY";

export interface TemplateVariable {
  index: number;
  description: string;
  example: string;
}

export interface TemplateButton {
  type: ButtonType;
  text: string;
  url?: string;
  phone_number?: string;
}

export interface TemplateContent {
  header?: string;
  body: string;
  footer?: string;
  buttons?: TemplateButton[];
  variables: TemplateVariable[];
}

export interface GeneratedTemplate {
  name: string;
  language: TemplateLang;
  category: "UTILITY";
  use_case: string;
  content: TemplateContent;
}

export interface ComplianceViolation {
  rule: string;
  severity: "error" | "warning";
  message: string;
  location: "header" | "body" | "footer" | "button";
  match?: string;
}

export interface ComplianceResult {
  passed: boolean;
  violations: ComplianceViolation[];
  score: number;
}

export interface GenerateRequest {
  event: string;
  description: string;
  hotel_name?: string;
  include_button: boolean;
  button_text?: string;
  // Regeneration fields
  previous_templates?: GeneratedTemplate[];
  feedback?: string;
}

export interface GenerateResponse {
  templates: GeneratedTemplate[];
  model_used: string;
}

export interface ApprovedTemplate {
  id: number;
  event: string;
  name: string;
  templates: GeneratedTemplate[];
  approved_at: string;
  notes?: string;
}

// Meta API submission format
export interface MetaTemplateSubmission {
  name: string;
  category: "UTILITY";
  language: string;
  components: MetaComponent[];
}

export interface MetaComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  text?: string;
  example?: { body_text?: string[][] };
  buttons?: MetaButton[];
}

export interface MetaButton {
  type: "URL" | "PHONE_NUMBER" | "QUICK_REPLY";
  text: string;
  url?: string;
  phone_number?: string;
}
