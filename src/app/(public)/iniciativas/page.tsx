"use client";

import { useState } from "react";
import { PIS_PRODUCTS } from "@/lib/pis/types";
import { SCORE_THRESHOLDS } from "@/lib/pis/constants";
import type { PisProduct, ScoringResult } from "@/lib/pis/types";

const PRODUCT_DESCRIPTIONS: Record<string, string> = {
  PreStay: "Engagement pre-llegada: web check-in, pedidos anticipados",
  OnSite: "Encuestas durante la estadía, Smart Replies, detección de problemas",
  FollowUp: "Encuestas post-estadía, reputación, NPS",
  Semantic: "Análisis semántico de reseñas y comentarios con IA",
  Concierge: "Asistente virtual IA por WhatsApp para huéspedes",
  Desk: "Gestión de incidentes y casos de huéspedes",
  Transversal: "Funcionalidades que impactan múltiples productos",
};

function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex ml-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-surface-2 text-text-dim hover:bg-accent/15 hover:text-accent transition-colors text-[10px] font-bold"
        aria-label="Más información"
      >
        i
      </button>
      {open && (
        <div className="absolute left-6 top-1/2 -translate-y-1/2 z-50 w-64 px-3 py-2 rounded-lg bg-text text-bg text-xs leading-relaxed shadow-lg animate-fade-in normal-case tracking-normal font-normal">
          {text}
          <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-text rotate-45" />
        </div>
      )}
    </span>
  );
}

function FieldLabel({
  label,
  tooltip,
  required,
}: {
  label: string;
  tooltip: string;
  required?: boolean;
}) {
  return (
    <label className="flex items-center text-[10px] font-semibold uppercase tracking-wider text-text-dim mb-1.5">
      {label}
      {required && <span className="text-negative ml-0.5">*</span>}
      <Tooltip text={tooltip} />
    </label>
  );
}

export default function PublicInitiativeForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [products, setProducts] = useState<PisProduct[]>([]);
  const [author, setAuthor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    title: string;
    id: number;
    scoring?: ScoringResult;
  } | null>(null);

  function toggleProduct(p: PisProduct) {
    setProducts((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setHypothesis("");
    setProducts([]);
    setAuthor("");
    setSuccess(null);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("El título es obligatorio");
      return;
    }
    if (!description.trim()) {
      setError("La descripción es obligatoria");
      return;
    }
    if (!hypothesis.trim()) {
      setError("La hipótesis es obligatoria");
      return;
    }
    if (products.length === 0) {
      setError("Selecciona al menos un producto");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/pis/initiatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          hypothesis: hypothesis.trim(),
          products,
          author: author.trim() || "Anónimo",
          status: "pre-evaluacion",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al enviar");
      }

      const data = await res.json();
      const initId = data.id;
      setSuccess({ title: title.trim(), id: initId });
      setSubmitting(false);

      // Auto-score in background
      setScoring(true);
      try {
        const scoreRes = await fetch(`/api/pis/initiatives/${initId}/score`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelId: "gemini-pro" }),
        });
        if (scoreRes.ok) {
          const scoreData = await scoreRes.json();
          setSuccess((prev) =>
            prev ? { ...prev, scoring: scoreData.scoring } : prev
          );
        }
      } catch {
        // Scoring failed silently — initiative is still saved
      } finally {
        setScoring(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setSubmitting(false);
    }
  }

  function scoreColor(score: number) {
    return score >= SCORE_THRESHOLDS.GREEN
      ? "text-positive"
      : score >= SCORE_THRESHOLDS.YELLOW
        ? "text-neutral-sent"
        : "text-negative";
  }

  function scoreBg(score: number) {
    return score >= SCORE_THRESHOLDS.GREEN
      ? "bg-positive-muted"
      : score >= SCORE_THRESHOLDS.YELLOW
        ? "bg-neutral-muted"
        : "bg-negative-muted";
  }

  // Success state
  if (success) {
    const sr = success.scoring;

    return (
      <div className="animate-fade-in space-y-6">
        {/* Confirmation header */}
        <div className="bg-positive-muted border border-positive/20 rounded-xl p-5 text-center">
          <h2 className="text-lg font-bold text-text">
            Iniciativa registrada exitosamente
          </h2>
          <p className="text-sm text-text-muted mt-1">
            &ldquo;{success.title}&rdquo; &middot; #{success.id}
          </p>
        </div>

        {/* Scoring results */}
        {scoring ? (
          <div className="bg-surface border border-border rounded-xl p-6 text-center space-y-3">
            <div className="animate-pulse-slow text-2xl">&#9881;</div>
            <p className="text-sm text-text-muted">
              Evaluando tu iniciativa con inteligencia artificial...
            </p>
            <p className="text-xs text-text-dim">
              Esto toma unos segundos. Estamos analizando el impacto potencial
              en los KPIs 2026 de myHotel.
            </p>
          </div>
        ) : sr ? (
          <div className="space-y-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-dim">
              Evaluación preliminar por IA
            </div>

            {/* Score cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className={`rounded-xl p-4 ${scoreBg(sr.pis_score)} border border-border/50`}>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-text-dim mb-1">
                  Puntaje PIS
                </div>
                <div className={`text-3xl font-bold ${scoreColor(sr.pis_score)}`}>
                  {sr.pis_score}%
                </div>
                <p className="text-xs text-text-muted mt-2 leading-relaxed">
                  {sr.score_criteria}
                </p>
              </div>
              <div className={`rounded-xl p-4 ${scoreBg(sr.hypothesis_score)} border border-border/50`}>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-text-dim mb-1">
                  Puntaje Hipótesis
                </div>
                <div className={`text-3xl font-bold ${scoreColor(sr.hypothesis_score)}`}>
                  {sr.hypothesis_score}%
                </div>
                <p className="text-xs text-text-muted mt-2 leading-relaxed">
                  {sr.hypothesis_feedback}
                </p>
              </div>
            </div>

            {/* KPI impacts */}
            {sr.kpi_impact && sr.kpi_impact.length > 0 && (
              <div className="bg-surface border border-border rounded-xl p-4">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-text-dim mb-2">
                  KPIs 2026 impactados
                </div>
                <div className="space-y-1.5">
                  {sr.kpi_impact.map((kpi) => (
                    <div key={kpi.kpi_id} className="flex items-start gap-2 text-xs">
                      <span className={`shrink-0 px-1.5 py-0.5 rounded font-semibold ${
                        kpi.impact === "alto" || kpi.impact === "high"
                          ? "bg-negative-muted text-negative"
                          : kpi.impact === "medio" || kpi.impact === "medium"
                            ? "bg-neutral-muted text-neutral-sent"
                            : "bg-positive-muted text-positive"
                      }`}>
                        {kpi.impact}
                      </span>
                      <span className="text-text-muted">
                        <strong>{kpi.kpi_name}</strong> &mdash; {kpi.explanation}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendation */}
            {sr.recommendation && (
              <div className="bg-accent/5 border border-accent/20 rounded-xl p-4">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-accent mb-1">
                  Recomendación preliminar
                </div>
                <p className="text-sm text-text leading-relaxed">
                  {sr.recommendation}
                </p>
              </div>
            )}

            <p className="text-[11px] text-text-dim text-center leading-relaxed">
              Esta es una evaluación preliminar generada por IA. El comité de producto
              revisará y confirmará la priorización final.
            </p>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-xl p-5 text-center">
            <p className="text-sm text-text-muted">
              Tu iniciativa será evaluada por el equipo de producto y presentada
              al comité con un puntaje de priorización.
            </p>
          </div>
        )}

        {/* Action */}
        <div className="text-center">
          <button
            onClick={resetForm}
            className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent-light transition-colors"
          >
            Enviar otra iniciativa
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Intro */}
      <div className="mb-8">
        <h1 className="text-xl font-bold text-text">
          Proponer una iniciativa de producto
        </h1>
        <p className="text-sm text-text-muted mt-2 leading-relaxed">
          Usa este formulario para proponer desarrollos o mejoras a los
          productos de myHotel. Cada iniciativa será evaluada automáticamente
          por IA contra los KPIs 2026 y presentada al comité de producto con
          un puntaje de priorización.
        </p>
        <p className="text-xs text-text-dim mt-2">
          Los campos marcados con{" "}
          <span className="text-negative font-bold">*</span> son obligatorios.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-negative-muted text-negative text-sm px-4 py-3 rounded-lg mb-6 animate-shake">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Título */}
        <div>
          <FieldLabel
            label="Título de la iniciativa"
            tooltip="Un nombre corto y descriptivo. Ejemplo: 'Auto-respuesta FAQ en Concierge' o 'Dashboard de métricas para Desk'"
            required
          />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Personalización de Smart Replies por perfil de huésped"
            className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text placeholder:text-text-dim/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
          />
        </div>

        {/* Descripción */}
        <div>
          <FieldLabel
            label="Descripción"
            tooltip="Explica en detalle qué hace esta iniciativa, qué problema resuelve, y quién se beneficia (el hotel, el huésped, el equipo interno, etc.)"
            required
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe el problema que resuelve, cómo funcionaría la solución, y quién se beneficiaría..."
            rows={4}
            className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text placeholder:text-text-dim/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors resize-y"
          />
        </div>

        {/* Hipótesis */}
        <div>
          <FieldLabel
            label="Hipótesis"
            tooltip="La razón de negocio detrás del desarrollo. Esta hipótesis será analizada por IA para evaluar su solidez, claridad y testeabilidad."
            required
          />
          <textarea
            value={hypothesis}
            onChange={(e) => setHypothesis(e.target.value)}
            placeholder='Ej: "Si implementamos X, entonces Y mejorará en Z%, porque..."'
            rows={3}
            className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text placeholder:text-text-dim/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors resize-y"
          />
          <p className="mt-1.5 text-[11px] text-text-dim leading-relaxed">
            <strong>Formato sugerido:</strong> &ldquo;Si [acción concreta],
            entonces [resultado esperado medible], porque [razón/evidencia].&rdquo;
            Una buena hipótesis es específica, medible y tiene lógica causal clara.
          </p>
        </div>

        {/* Productos */}
        <div>
          <FieldLabel
            label="Productos impactados"
            tooltip="Selecciona uno o más productos de myHotel que se verían afectados por esta iniciativa. Si afecta a varios, selecciona todos los relevantes."
            required
          />
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {PIS_PRODUCTS.map((p) => {
                const selected = products.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggleProduct(p)}
                    className={`group relative px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                      selected
                        ? "bg-accent/15 border-accent/40 text-accent-light shadow-sm"
                        : "bg-surface border-border text-text-muted hover:border-border-light hover:bg-surface-2"
                    }`}
                  >
                    <span className="font-semibold">{p}</span>
                    <span
                      className={`block text-[10px] font-normal mt-0.5 leading-tight ${
                        selected ? "text-accent/70" : "text-text-dim"
                      }`}
                    >
                      {PRODUCT_DESCRIPTIONS[p]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Autor */}
        <div>
          <FieldLabel
            label="Tu nombre"
            tooltip="Para que el comité de producto pueda contactarte si necesita más contexto sobre la iniciativa."
          />
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Nombre y apellido"
            className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text placeholder:text-text-dim/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
          />
        </div>

        {/* Submit */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="w-full px-4 py-3 bg-accent text-white text-sm font-semibold rounded-lg hover:bg-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Enviando..." : "Enviar iniciativa"}
          </button>
          <p className="mt-2 text-[11px] text-text-dim text-center">
            Tu iniciativa será evaluada por IA y priorizada contra los KPIs 2026 de myHotel
          </p>
        </div>
      </form>
    </div>
  );
}
