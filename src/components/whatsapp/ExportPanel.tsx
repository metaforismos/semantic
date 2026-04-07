"use client";

import { useState } from "react";
import type { GeneratedTemplate } from "@/lib/whatsapp/types";
import { toExportJSON } from "@/lib/whatsapp/export";

interface Props {
  templates: GeneratedTemplate[];
  event: string;
  onMarkApproved: () => void;
  isSaving: boolean;
}

export default function ExportPanel({ templates, event, onMarkApproved, isSaving }: Props) {
  const [copied, setCopied] = useState(false);
  const [showJSON, setShowJSON] = useState(false);

  const exportJSON = toExportJSON(templates);

  function handleCopy() {
    navigator.clipboard.writeText(exportJSON);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowJSON(!showJSON)}
          className="px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-surface-2 text-text-muted hover:text-text hover:bg-surface-3 transition-colors"
        >
          {showJSON ? "Ocultar JSON" : "Ver JSON para Meta"}
        </button>
        <button
          onClick={handleCopy}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-accent text-white hover:bg-accent-light transition-colors"
        >
          {copied ? "Copiado" : "Copiar JSON"}
        </button>
        <button
          onClick={onMarkApproved}
          disabled={isSaving}
          className="px-3 py-1.5 text-xs font-medium rounded-md border border-positive/30 bg-positive/10 text-positive hover:bg-positive/20 transition-colors disabled:opacity-40"
        >
          {isSaving ? "Guardando..." : "Marcar como aprobado"}
        </button>
      </div>

      {showJSON && (
        <div className="animate-fade-in">
          <textarea
            readOnly
            value={exportJSON}
            className="w-full h-64 px-3 py-2 bg-surface-2 border border-border rounded-md text-xs font-mono text-text resize-y focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}
