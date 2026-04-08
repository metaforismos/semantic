"use client";

import { useState, useRef } from "react";
import type { GeneratedTemplate, TemplateContent } from "@/lib/whatsapp/types";
import { checkCompliance } from "@/lib/whatsapp/compliance";
import { NAMED_VARIABLES } from "@/lib/whatsapp/constants";
import WhatsAppPreview from "@/components/whatsapp/WhatsAppPreview";
import ComplianceReport from "@/components/whatsapp/ComplianceReport";

export default function WhatsAppTemplatesPage() {
  const [body, setBody] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [header, setHeader] = useState("");
  const [footer, setFooter] = useState("");
  const [includeButton, setIncludeButton] = useState(false);
  const [buttonText, setButtonText] = useState("");
  const [evaluated, setEvaluated] = useState(false);

  const canEvaluate = body.trim().length > 0;

  function buildTemplate(): GeneratedTemplate {
    const content: TemplateContent = {
      body: body.trim(),
      variables: [],
    };
    if (header.trim()) content.header = header.trim();
    if (footer.trim()) content.footer = footer.trim();
    if (includeButton && buttonText.trim()) {
      content.buttons = [{ type: "QUICK_REPLY", text: buttonText.trim() }];
    }
    return {
      name: "user_template",
      language: "es",
      category: "UTILITY",
      use_case: "qualification",
      content,
    };
  }

  const template = buildTemplate();
  const compliance = evaluated ? checkCompliance(template) : null;

  // Detect which named variables are used
  const allText = [template.content.header, template.content.body, template.content.footer]
    .filter(Boolean)
    .join(" ");
  const usedNamedVars = NAMED_VARIABLES.filter((nv) =>
    allText.includes(`{{${nv.name}}}`),
  );

  function insertAtCursor(variable: string) {
    const el = bodyRef.current;
    if (!el) {
      setBody((prev) => prev + variable);
    } else {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newBody = body.slice(0, start) + variable + body.slice(end);
      setBody(newBody);
      if (evaluated) setEvaluated(false);
      // Restore focus and cursor after the inserted text
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + variable.length;
        el.setSelectionRange(pos, pos);
      });
    }
  }

  function handleEvaluate() {
    setEvaluated(true);
  }

  function handleClear() {
    setBody("");
    setHeader("");
    setFooter("");
    setIncludeButton(false);
    setButtonText("");
    setEvaluated(false);
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
            Template Qualifier
          </span>
        </div>
        <h1 className="text-xl font-bold text-text tracking-tight">
          WhatsApp Template Qualifier
        </h1>
        <p className="text-sm text-text-muted mt-1 max-w-xl">
          Pega el texto de tu template de WhatsApp y evalua si cumple con las politicas de Meta
          para clasificacion Utility. Detecta palabras prohibidas, tono promocional, y problemas estructurales.
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
        {/* Left: sticky form */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
            {/* Body textarea */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-dim block mb-1.5">
                Cuerpo del template <span className="text-negative">*</span>
              </label>
              <textarea
                ref={bodyRef}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  if (evaluated) setEvaluated(false);
                }}
                rows={6}
                placeholder={"Ej: Hola {{guest_name}}, tu reserva en {{hotel_name}} esta confirmada.\n\nCheck-in: {{guest_checkin}}\nCheck-out: {{guest_checkout}}\nReserva: {{guest_reservation_id}}"}
                className="w-full px-3 py-2.5 bg-surface-2 border border-border rounded-md text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors resize-y font-mono"
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-text-dim">
                  {body.length}/1024 caracteres
                </span>
                {body.length > 1024 && (
                  <span className="text-[10px] text-negative font-medium">
                    Excede el limite
                  </span>
                )}
              </div>
              {/* Variable chips — click to insert at cursor */}
              <div className="mt-2">
                <span className="text-[10px] text-text-dim block mb-1">Insertar variable:</span>
                <div className="flex flex-wrap gap-1">
                  {NAMED_VARIABLES.map((v) => (
                    <button
                      key={v.name}
                      type="button"
                      title={v.description}
                      onClick={() => insertAtCursor(`{{${v.name}}}`)}
                      className="px-1.5 py-0.5 text-[10px] font-mono rounded border border-accent/20 bg-accent/5 text-accent hover:bg-accent/15 hover:border-accent/40 transition-colors"
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Header (optional) */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-dim block mb-1.5">
                Header <span className="opacity-50">(opcional)</span>
              </label>
              <input
                type="text"
                value={header}
                onChange={(e) => {
                  setHeader(e.target.value);
                  if (evaluated) setEvaluated(false);
                }}
                placeholder="Ej: Confirmacion de reserva"
                className="w-full px-3 py-2.5 bg-surface-2 border border-border rounded-md text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
              />
              <span className="text-[10px] text-text-dim mt-0.5 block">{header.length}/60</span>
            </div>

            {/* Footer (optional) */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-dim block mb-1.5">
                Footer <span className="opacity-50">(opcional)</span>
              </label>
              <input
                type="text"
                value={footer}
                onChange={(e) => {
                  setFooter(e.target.value);
                  if (evaluated) setEvaluated(false);
                }}
                placeholder="Ej: myHotel — Powered by AI"
                className="w-full px-3 py-2.5 bg-surface-2 border border-border rounded-md text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
              />
              <span className="text-[10px] text-text-dim mt-0.5 block">{footer.length}/60</span>
            </div>

            {/* Button toggle */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-dim">
                  Incluir boton
                </label>
                <button
                  onClick={() => {
                    setIncludeButton(!includeButton);
                    if (evaluated) setEvaluated(false);
                  }}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    includeButton ? "bg-accent" : "bg-surface-3"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                      includeButton ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              {includeButton && (
                <input
                  type="text"
                  value={buttonText}
                  onChange={(e) => {
                    setButtonText(e.target.value);
                    if (evaluated) setEvaluated(false);
                  }}
                  placeholder="Ej: Ver reserva, Descargar comprobante..."
                  className="w-full px-3 py-2.5 bg-surface-2 border border-border rounded-md text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors animate-fade-in"
                />
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleEvaluate}
                disabled={!canEvaluate}
                className="flex-1 py-2.5 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Evaluar Template
              </button>
              {(body || header || footer) && (
                <button
                  onClick={handleClear}
                  className="px-4 py-2.5 text-sm text-text-muted border border-border rounded-md hover:bg-surface-2 transition-colors"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: results */}
        <div className="min-w-0">
          {evaluated && compliance ? (
            <div className="space-y-5 animate-fade-in">
              {/* Compliance report */}
              <div className="bg-surface border border-border rounded-lg p-5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-text-dim mb-3">
                  Resultado de Evaluacion
                </div>
                <ComplianceReport result={compliance} />
              </div>

              {/* WhatsApp preview */}
              <div className="bg-surface border border-border rounded-lg p-5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-text-dim mb-3">
                  Vista Previa WhatsApp
                </div>
                <WhatsAppPreview content={template.content} />
              </div>

              {/* Variables detected */}
              {usedNamedVars.length > 0 && (
                <div className="bg-surface border border-border rounded-md overflow-hidden">
                  <div className="px-3 py-1.5 bg-surface-2 border-b border-border">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-text-dim">
                      Variables detectadas
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
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-lg p-8 text-center">
              <div className="text-text-dim text-sm mb-2">
                Pega el texto de tu template y presiona Evaluar.
              </div>
              <div className="text-text-dim text-xs max-w-sm mx-auto">
                El evaluador verifica compliance con las reglas de Meta para templates Utility:
                palabras prohibidas, tono promocional, longitud, variables, y mas.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
