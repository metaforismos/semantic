"use client";

import { useState } from "react";
import type { GeneratedTemplate } from "@/lib/whatsapp/types";
import TemplateRequestForm from "@/components/whatsapp/TemplateRequestForm";
import TemplateResults from "@/components/whatsapp/TemplateResults";

export default function WhatsAppTemplatesPage() {
  // Form state
  const [event, setEvent] = useState("");
  const [description, setDescription] = useState("");
  const [hotelName, setHotelName] = useState("");
  const [includeButton, setIncludeButton] = useState(false);
  const [buttonText, setButtonText] = useState("");

  // Result state
  const [templates, setTemplates] = useState<GeneratedTemplate[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);
    setTemplates([]);
    setSavedMessage(null);

    try {
      const res = await fetch("/api/whatsapp/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event,
          description,
          hotel_name: hotelName || undefined,
          include_button: includeButton,
          button_text: includeButton ? buttonText : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error generating templates");
      }

      setTemplates(data.templates);
      setModelUsed(data.model_used);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleRegenerate(feedback: string) {
    setIsRegenerating(true);
    setError(null);
    setSavedMessage(null);

    try {
      const res = await fetch("/api/whatsapp/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event,
          description,
          hotel_name: hotelName || undefined,
          include_button: includeButton,
          button_text: includeButton ? buttonText : undefined,
          previous_templates: templates,
          feedback,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error regenerating templates");
      }

      setTemplates(data.templates);
      setModelUsed(data.model_used);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsRegenerating(false);
    }
  }

  async function handleMarkApproved() {
    if (templates.length === 0) return;
    setIsSaving(true);
    setSavedMessage(null);

    try {
      const res = await fetch("/api/whatsapp/approved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event,
          name: templates[0].name,
          templates,
          notes: description,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error saving approved template");
      }

      setSavedMessage("Template guardado como aprobado. Se usara como ejemplo en futuras generaciones.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="pt-14 lg:pt-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-dim">
            WhatsApp
          </span>
          <span className="text-text-dim">/</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-dim">
            Template Builder
          </span>
        </div>
        <h1 className="text-xl font-bold text-text tracking-tight">
          WhatsApp Template Builder
        </h1>
        <p className="text-sm text-text-muted mt-1 max-w-xl">
          Genera templates de WhatsApp en 3 idiomas optimizados para clasificacion Utility de Meta.
          Tono estrictamente transaccional para evitar reclasificacion a Marketing.
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        {/* Left: sticky form */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <TemplateRequestForm
            event={event}
            setEvent={setEvent}
            description={description}
            setDescription={setDescription}
            hotelName={hotelName}
            setHotelName={setHotelName}
            includeButton={includeButton}
            setIncludeButton={setIncludeButton}
            buttonText={buttonText}
            setButtonText={setButtonText}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
          />
        </div>

        {/* Right: results */}
        <div className="min-w-0">
          {/* Loading state */}
          {isGenerating && (
            <div className="bg-surface border border-border rounded-lg p-8 flex flex-col items-center justify-center gap-3 animate-fade-in">
              <svg className="animate-spin h-8 w-8 text-accent" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-text-muted">Generando templates en 3 idiomas...</p>
              <p className="text-xs text-text-dim">Aplicando reglas de compliance Meta Utility</p>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="bg-negative/5 border border-negative/20 rounded-lg px-4 py-3 text-sm text-negative animate-fade-in">
              {error}
            </div>
          )}

          {/* Saved confirmation */}
          {savedMessage && (
            <div className="bg-positive/5 border border-positive/20 rounded-lg px-4 py-3 text-sm text-positive animate-fade-in mb-4">
              {savedMessage}
            </div>
          )}

          {/* Results */}
          {templates.length > 0 && !isGenerating && (
            <div>
              {modelUsed && (
                <div className="text-[10px] text-text-dim mb-3">
                  Modelo: <span className="font-mono">{modelUsed}</span>
                </div>
              )}
              <TemplateResults
                templates={templates}
                event={event}
                onRegenerate={handleRegenerate}
                isRegenerating={isRegenerating}
                onMarkApproved={handleMarkApproved}
                isSaving={isSaving}
              />
            </div>
          )}

          {/* Empty state */}
          {templates.length === 0 && !isGenerating && !error && (
            <div className="bg-surface border border-border rounded-lg p-8 text-center">
              <div className="text-text-dim text-sm mb-2">
                Selecciona un evento, describe el template y genera.
              </div>
              <div className="text-text-dim text-xs max-w-sm mx-auto">
                Los templates se generan en espanol, ingles y portugues siguiendo las reglas de Meta para clasificacion Utility.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
