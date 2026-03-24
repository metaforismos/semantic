"use client";

import { useState } from "react";
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

function BigNumber({ value, unit, label, tooltip }: { value: string; unit?: string; label: string; tooltip?: string }) {
  return (
    <div className="bg-surface-2 rounded-lg p-4 text-center group relative">
      <div className="text-2xl font-bold text-accent">
        {value}
        {unit && <span className="text-sm font-normal text-text-muted ml-1">{unit}</span>}
      </div>
      <div className="text-xs text-text-dim mt-1">{label}</div>
      {tooltip && <Tooltip text={tooltip} />}
    </div>
  );
}

function Tooltip({ text }: { text: string }) {
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-text text-surface text-[10px] leading-relaxed rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-56 text-center shadow-lg">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-text" />
    </div>
  );
}

function MetricInfo({ text }: { text: string }) {
  return (
    <div className="text-[11px] text-text-dim leading-relaxed bg-surface-2 rounded-lg px-3 py-2 mt-3">
      {text}
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

  const labels: Record<string, string> = {
    "1": "Muy insatisfecho",
    "2": "Insatisfecho",
    "3": "Neutral",
    "4": "Satisfecho",
    "5": "Muy satisfecho",
  };

  return (
    <div className="space-y-3">
      <div className="flex h-10 rounded-lg overflow-hidden">
        {["1", "2", "3", "4", "5"].map((score) => {
          const count = distribution[score] || 0;
          const pct = (count / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={score}
              className="flex items-center justify-center text-white text-xs font-bold transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: colors[score], minWidth: pct > 0 ? "24px" : "0" }}
              title={`Score ${score}: ${count} (${Math.round(pct)}%)`}
            >
              {pct >= 8 && score}
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="grid grid-cols-5 gap-2">
        {["1", "2", "3", "4", "5"].map((score) => {
          const count = distribution[score] || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={score} className="text-center">
              <div className="flex items-center justify-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colors[score] }} />
                <span className="text-xs font-medium text-text">{pct}%</span>
              </div>
              <div className="text-[10px] text-text-dim">{labels[score]}</div>
              <div className="text-[10px] text-text-dim">({count})</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ReportPreview({ data }: ReportPreviewProps) {
  const { meta, metrics, success_cases, improvement_opportunities } = data;

  return (
    <div id="pilot-report" className="space-y-6">
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

      {/* 3. Main Metrics — 3 donuts (removed valid data rate) */}
      <section className="bg-surface border border-border rounded-xl p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-text-dim mb-4">
          Métricas Principales
        </h2>

        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="group relative flex flex-col items-center">
            <DonutChart
              value={metrics.interaction_rate.overall}
              label="Tasa de Interacción"
              sublabel={`${metrics.interaction_rate.responded} / ${metrics.interaction_rate.contacted}`}
            />
            <Tooltip text="Conversaciones donde el huésped envió al menos 1 mensaje, dividido por el total de conversaciones con campaña enviada." />
          </div>
          <div className="group relative flex flex-col items-center">
            <DonutChart
              value={metrics.automation_rate.rate}
              label="Tasa de Automatización"
              sublabel={`${metrics.automation_rate.not_derived} / ${metrics.automation_rate.total_ia_messages} msgs`}
              color="var(--color-positive)"
            />
            <Tooltip text="Mensajes del concierge que resolvieron la consulta sin derivar al huésped a un ser humano (recepción, extensión, etc.)." />
          </div>
          <div className="group relative flex flex-col items-center">
            <DonutChart
              value={metrics.inferred_satisfaction.positive_rate}
              label="Satisfacción Positiva"
              sublabel={metrics.inferred_satisfaction.positive_label}
              color="var(--color-positive)"
            />
            <Tooltip text="Porcentaje de conversaciones con score de satisfacción 4 o 5 (inferido por IA a partir del tono del huésped)." />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <BigNumber
            value={String(metrics.response_time.bot_median_seconds)}
            unit="seg"
            label={`Tiempo de respuesta ${meta.concierge_name}`}
            tooltip={`Mediana del tiempo entre un mensaje del huésped y la respuesta del concierge. Benchmark humano: ${metrics.response_time.human_benchmark_minutes} minutos.`}
          />
          <BigNumber
            value={String(metrics.time_saved.hours)}
            unit="hrs"
            label="Tiempo ahorrado"
            tooltip={`(Total mensajes IA) × (${metrics.response_time.human_benchmark_minutes} min benchmark humano − ${metrics.response_time.bot_median_seconds} seg respuesta bot). Equivale a ${metrics.time_saved.equivalent_manual_tasks} respuestas manuales.`}
          />
          <BigNumber
            value={String(meta.active_conversations)}
            label="Conversaciones activas"
            tooltip="Conversaciones donde el huésped envió al menos un mensaje."
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
          <MetricInfo text="Tasa de interacción segmentada por tipo de campaña (PreStay, Welcome, etc.). Muestra qué campañas generan más engagement." />
        </section>
      )}

      {/* 4. Satisfaction */}
      <section className="bg-surface border border-border rounded-xl p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-text-dim mb-4">
          Satisfacción Inferida
        </h2>
        <SatisfactionBar distribution={metrics.inferred_satisfaction.distribution} />
        <MetricInfo text="Score de satisfacción (1-5) inferido por IA analizando el tono y contenido de los mensajes del huésped en cada conversación. 5 = muy satisfecho (agradecimiento explícito), 4 = satisfecho (consulta resuelta), 3 = neutral, 2 = algo frustrado, 1 = muy insatisfecho (queja explícita)." />
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
          <MetricInfo text="Temas clasificados por IA a partir del contenido de cada conversación, usando un vocabulario controlado. Una conversación puede tener múltiples temas." />
        </section>
      )}

      {/* 6. Derivation Analysis — FULL breakdown */}
      {metrics.derivation_rate.top_reasons.length > 0 && (
        <section className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-text-dim mb-4">
            Análisis de Derivaciones
          </h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-surface-2 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-text">{metrics.automation_rate.total_ia_messages}</div>
              <div className="text-[10px] text-text-dim">Total mensajes IA</div>
            </div>
            <div className="bg-positive-muted/50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-positive">{metrics.automation_rate.not_derived}</div>
              <div className="text-[10px] text-text-dim">Resueltos directamente</div>
            </div>
            <div className="bg-neutral-muted/50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-neutral-sent">{metrics.automation_rate.derived}</div>
              <div className="text-[10px] text-text-dim">Derivados a humano</div>
            </div>
          </div>

          <h3 className="text-xs font-semibold text-text mb-3">Motivos de derivación</h3>
          <BarChart
            items={metrics.derivation_rate.top_reasons.map((r) => ({
              label: r.reason,
              value: r.pct,
              count: r.count,
            }))}
            color="var(--color-neutral-sent)"
            maxItems={20}
          />
          <MetricInfo text="Un mensaje IA se clasifica como 'derivado' cuando redirige al huésped a un ser humano (recepción, extensión telefónica, email, etc.). Cada motivo es una oportunidad de completar la base de conocimiento para resolución directa." />
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
          <MetricInfo text="Conversaciones donde la satisfacción inferida es ≥ 4, no hubo derivación a humano, y el huésped envió 3+ mensajes." />
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
        <p className="text-sm text-text max-w-3xl mx-auto">
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
