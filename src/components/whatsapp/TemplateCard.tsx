"use client";

import type { GeneratedTemplate } from "@/lib/whatsapp/types";
import { checkCompliance } from "@/lib/whatsapp/compliance";
import { NAMED_VARIABLES } from "@/lib/whatsapp/constants";
import WhatsAppPreview from "./WhatsAppPreview";
import ComplianceReport from "./ComplianceReport";

interface Props {
  template: GeneratedTemplate;
}

export default function TemplateCard({ template }: Props) {
  const compliance = checkCompliance(template);

  // Find which named variables are used in this template
  const allText = [template.content.header, template.content.body, template.content.footer]
    .filter(Boolean)
    .join(" ");
  const usedNamedVars = NAMED_VARIABLES.filter((nv) =>
    allText.includes(`{{${nv.name}}}`),
  );

  return (
    <div className="space-y-4">
      {/* Template name */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-text-dim bg-surface-2 px-2 py-0.5 rounded">
          {template.name}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-text-dim font-semibold">
          {template.language}
        </span>
      </div>

      {/* WhatsApp preview */}
      <WhatsAppPreview content={template.content} />

      {/* Variables table */}
      {(usedNamedVars.length > 0 || template.content.variables.length > 0) && (
        <div className="bg-surface border border-border rounded-md overflow-hidden">
          <div className="px-3 py-1.5 bg-surface-2 border-b border-border">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-text-dim">
              Variables
            </span>
          </div>
          <div className="divide-y divide-border">
            {usedNamedVars.map((nv) => (
              <div key={nv.name} className="px-3 py-2 flex items-center gap-3 text-xs">
                <span className="font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded shrink-0">
                  {`{{${nv.name}}}`}
                </span>
                <span className="text-text flex-1">{nv.description}</span>
                <span className="text-text-dim font-mono">{nv.example}</span>
              </div>
            ))}
            {template.content.variables.map((v) => (
              <div key={v.index} className="px-3 py-2 flex items-center gap-3 text-xs">
                <span className="font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded shrink-0">
                  {`{{${v.index}}}`}
                </span>
                <span className="text-text flex-1">{v.description}</span>
                <span className="text-text-dim font-mono">{v.example}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compliance report */}
      <div className="bg-surface border border-border rounded-md p-4">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-text-dim mb-2">
          Compliance Check
        </div>
        <ComplianceReport result={compliance} />
      </div>
    </div>
  );
}
