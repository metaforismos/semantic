"use client";

import { useState } from "react";
import type { GeneratedTemplate, TemplateLang } from "@/lib/whatsapp/types";
import TemplateCard from "./TemplateCard";
import ExportPanel from "./ExportPanel";

interface Props {
  templates: GeneratedTemplate[];
  event: string;
  onRegenerate: (feedback: string) => void;
  isRegenerating: boolean;
  onMarkApproved: () => void;
  isSaving: boolean;
}

const LANG_LABELS: Record<TemplateLang, string> = {
  es: "Espanol",
  en: "English",
  pt: "Portugues",
};

export default function TemplateResults({
  templates,
  event,
  onRegenerate,
  isRegenerating,
  onMarkApproved,
  isSaving,
}: Props) {
  const [activeLang, setActiveLang] = useState<TemplateLang>("es");
  const [feedback, setFeedback] = useState("");

  const activeTemplate = templates.find((t) => t.language === activeLang);

  function handleRegenerate() {
    if (!feedback.trim()) return;
    onRegenerate(feedback.trim());
    setFeedback("");
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Language tabs */}
      <div className="flex gap-1 bg-surface-2 rounded-lg p-1 w-fit">
        {(["es", "en", "pt"] as TemplateLang[]).map((lang) => (
          <button
            key={lang}
            onClick={() => setActiveLang(lang)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeLang === lang
                ? "bg-accent text-white"
                : "text-text-muted hover:text-text hover:bg-surface-3"
            }`}
          >
            {LANG_LABELS[lang]}
          </button>
        ))}
      </div>

      {/* Active template */}
      {activeTemplate && <TemplateCard template={activeTemplate} />}

      {/* Feedback + regenerate */}
      <div className="bg-surface border border-border rounded-md p-4">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-text-dim mb-2">
          Regenerar con feedback
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRegenerate()}
            placeholder="Ej: hacerlo mas corto, agregar hora de check-in, quitar el footer..."
            className="flex-1 px-3 py-2 bg-surface-2 border border-border rounded-md text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/30 transition-colors"
            disabled={isRegenerating}
          />
          <button
            onClick={handleRegenerate}
            disabled={!feedback.trim() || isRegenerating}
            className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-white hover:bg-accent-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {isRegenerating ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Regenerando...
              </span>
            ) : (
              "Regenerar"
            )}
          </button>
        </div>
      </div>

      {/* Export panel */}
      <div className="bg-surface border border-border rounded-md p-4">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-text-dim mb-3">
          Exportar
        </div>
        <ExportPanel
          templates={templates}
          event={event}
          onMarkApproved={onMarkApproved}
          isSaving={isSaving}
        />
      </div>
    </div>
  );
}
