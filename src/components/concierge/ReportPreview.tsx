"use client";

import type { PilotReportData } from "@/lib/concierge/types";
import { DonutChart } from "./DonutChart";
import { BarChart } from "./BarChart";

interface ReportPreviewProps {
  data: PilotReportData;
}

function automationLabel(rate: number): string {
  if (rate >= 0.8) return "Excelente";
  if (rate >= 0.6) return "Buena";
  return "Con alto potencial de crecimiento";
}

function BigNumber({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <div className="bg-surface-2 rounded-lg p-4 text-center">
      <div className="text-2xl font-bold text-accent">
        {value}
        {unit && <span className="text-sm font-normal text-text-muted ml-1">{unit}</span>}
      </div>
      <div className="text-xs text-text-dim mt-1">{label}</div>
    </div>
  );
}

function SatisfactionBar({ distribution }: { distribution: Record<string, number> }) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const colors: Record<string, string> = {
    "1": "#dc2626",
    "2": "#f97316",
    "3": "#ca8a04",
    "4": "#65a30d",
    "5": "#16a34a",
  };

  return (
    <div className="space-y-2">
      <div className="flex h-8 rounded-lg overflow-hidden">
        {["1", "2", "3", "4", "5"].map((score) => {
          const count = distribution[score] || 0;
          const pct = (count / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={score}
              className="flex items-center justify-center text-white text-[10px] font-bold transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: colors[score], minWidth: pct > 0 ? "20px" : "0" }}
              title={`Score ${score}: ${count} (${Math.round(pct)}%)`}
            >
              {pct >= 8 && score}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-text-dim">
        <span>1 - Muy insatisfecho</span>
        <span>5 - Muy satisfecho</span>
      </div>
    </div>
  );
}

export function ReportPreview({ data }: ReportPreviewProps) {
  const { meta, metrics, success_cases, improvement_opportunities } = data;

  return (
    <div id="pilot-report" className="space-y-6 max-w-4xl mx-auto">
      {/* 1. Header / Cover */}
      <div className="bg-accent text-white rounded-xl p-8 text-center">
        <div className="text-[10px] uppercase tracking-[0.2em] opacity-70 mb-2">myHotel Labs</div>
        <h1 className="text-2xl font-bold mb-1">Reporte Piloto Concierge</h1>
        <div className="text-lg font-medium opacity-90">{meta.hotel_name}</div>
        <div className="text-sm opacity-70 mt-2">
          {meta.period_start} — {meta.period_end}
        </div>
      </div>

      {/* 2. Executive Summary */}
      <section className="bg-surface border border-border rounded-xl p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-text-dim mb-4">
          Resumen Ejecutivo
        </h2>
        <div className="space-y-2 text-sm text-text">
          <p>
            Durante el período de evaluación, Concierge ({meta.concierge_name}) atendió{" "}
            <strong>{metrics.interaction_rate.responded}</strong> conversaciones activas de{" "}
            <strong>{metrics.interaction_rate.contacted}</strong> huéspedes contactados.
          </p>
          <p>
            Se resolvieron automáticamente el{" "}
            <strong>{Math.round(metrics.automation_rate.rate * 100)}%</strong> de los mensajes
            ({automationLabel(metrics.automation_rate.rate)}).
          </p>
          <p>
            El tiempo de respuesta promedio fue de{" "}
            <strong>{metrics.response_time.bot_median_seconds} segundos</strong>, vs{" "}
            {metrics.response_time.human_benchmark_minutes} minutos del benchmark humano,
            ahorrando aproximadamente <strong>{metrics.time_saved.hours} horas</strong> de
            trabajo manual.
          </p>
          <p>
            El <strong>{Math.round(metrics.inferred_satisfaction.positive_rate * 100)}%</strong>{" "}
            de los huéspedes mostró satisfacción positiva (score 4 o 5).
          </p>
        </div>
      </section>

      {/* 3. Main Metrics */}
      <section className="bg-surface border border-border rounded-xl p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-text-dim mb-4">
          Métricas Principales
        </h2>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <DonutChart
            value={metrics.interaction_rate.overall}
            label="Tasa de Interacción"
            sublabel={`${metrics.interaction_rate.responded} / ${metrics.interaction_rate.contacted}`}
          />
          <DonutChart
            value={metrics.automation_rate.rate}
            label="Tasa de Automatización"
            sublabel={`${metrics.automation_rate.not_derived} / ${metrics.automation_rate.total_ia_messages} msgs`}
            color="var(--color-positive)"
          />
          <DonutChart
            value={metrics.valid_data_rate.phone}
            label="Datos Válidos (tel.)"
            sublabel={metrics.valid_data_rate.note}
          />
          <DonutChart
            value={metrics.inferred_satisfaction.positive_rate}
            label="Satisfacción Positiva"
            sublabel={metrics.inferred_satisfaction.positive_label}
            color="var(--color-positive)"
          />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <BigNumber
            value={String(metrics.response_time.bot_median_seconds)}
            unit="seg"
            label={`Tiempo de respuesta ${meta.concierge_name} (vs ${metrics.response_time.human_benchmark_minutes} min humano)`}
          />
          <BigNumber
            value={String(metrics.time_saved.hours)}
            unit="hrs"
            label="Tiempo ahorrado"
          />
          <BigNumber
            value={String(meta.active_conversations)}
            label="Conversaciones activas"
          />
        </div>
      </section>

      {/* Interaction by origin */}
      {metrics.interaction_by_origin.length > 0 && (
        <section className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-text-dim mb-4">
            Interacción por Origen
          </h2>
          <BarChart
            items={metrics.interaction_by_origin.map((o) => ({
              label: o.origin,
              value: o.rate,
              count: o.responded,
              sublabel: `${o.responded}/${o.contacted}`,
            }))}
          />
        </section>
      )}

      {/* 4. Satisfaction */}
      <section className="bg-surface border border-border rounded-xl p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-text-dim mb-4">
          Satisfacción Inferida
        </h2>
        <SatisfactionBar distribution={metrics.inferred_satisfaction.distribution} />
      </section>

      {/* 5. Top Topics */}
      {metrics.top_topics.length > 0 && (
        <section className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-text-dim mb-4">
            Temas Más Consultados
          </h2>
          <BarChart
            items={metrics.top_topics.map((t) => ({
              label: t.topic,
              value: t.pct,
              count: t.count,
            }))}
            color="var(--color-accent-light)"
          />
        </section>
      )}

      {/* 6. Derivation Analysis */}
      {metrics.derivation_rate.top_reasons.length > 0 && (
        <section className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-text-dim mb-4">
            Oportunidades de Resolución Directa
          </h2>
          <p className="text-xs text-text-muted mb-4">
            Motivos por los que {meta.concierge_name} derivó consultas a recepción. Cada motivo representa una oportunidad
            de mejorar la resolución automática completando la base de conocimiento.
          </p>
          <BarChart
            items={metrics.derivation_rate.top_reasons.map((r) => ({
              label: r.reason,
              value: r.pct,
              count: r.count,
            }))}
            color="var(--color-neutral-sent)"
          />
        </section>
      )}

      {/* 7. Success Cases */}
      {success_cases.length > 0 && (
        <section className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-text-dim mb-4">
            Casos de Éxito
          </h2>
          <div className="space-y-3">
            {success_cases.map((sc, idx) => (
              <div
                key={idx}
                className="bg-positive-muted/30 border border-positive/20 rounded-lg p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm text-text">{sc.summary}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {sc.topics.map((t, i) => (
                        <span
                          key={i}
                          className="text-[10px] bg-surface-2 text-text-muted px-2 py-0.5 rounded"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs font-bold text-positive">{sc.satisfaction_score}/5</span>
                  </div>
                </div>
                <a
                  href={sc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-accent hover:underline mt-2 inline-block"
                >
                  Ver conversación completa →
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 8. Improvement Opportunities */}
      {improvement_opportunities.length > 0 && (
        <section className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-text-dim mb-4">
            Oportunidades de Mejora
          </h2>
          <div className="space-y-3">
            {improvement_opportunities.map((opp, idx) => (
              <div key={idx} className="flex items-start gap-3 bg-surface-2 rounded-lg p-3">
                <span
                  className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded shrink-0 ${
                    opp.owner === "hotel"
                      ? "bg-neutral-muted text-neutral-sent"
                      : "bg-labs-yellow-bg text-labs-yellow"
                  }`}
                >
                  {opp.owner === "hotel" ? "Hotel" : "Roadmap"}
                </span>
                <div>
                  <div className="text-sm text-text">{opp.detail}</div>
                  <div className="text-xs text-text-dim mt-0.5">{opp.impact}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 9. Conclusion */}
      <section className="bg-accent/5 border border-accent/20 rounded-xl p-6 text-center">
        <h2 className="text-sm font-bold uppercase tracking-wide text-accent mb-3">
          Conclusión
        </h2>
        <p className="text-sm text-text max-w-2xl mx-auto">
          Concierge ({meta.concierge_name}) demostró ser una herramienta efectiva durante el piloto en{" "}
          <strong>{meta.hotel_name}</strong>, resolviendo el{" "}
          <strong>{Math.round(metrics.automation_rate.rate * 100)}%</strong> de las consultas
          automáticamente y ahorrando <strong>{metrics.time_saved.hours} horas</strong> de trabajo
          manual. Recomendamos avanzar con la contratación para maximizar el potencial de
          automatización y mejorar la experiencia de los huéspedes.
        </p>
      </section>
    </div>
  );
}
