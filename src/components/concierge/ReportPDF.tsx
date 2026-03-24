import { Document, Page, Text, View, StyleSheet, Link } from "@react-pdf/renderer";
import type { PilotReportData } from "@/lib/concierge/types";

const colors = {
  bg: "#f8f8fa",
  surface: "#ffffff",
  surface2: "#f0f0f4",
  surface3: "#e6e6ed",
  border: "#d4d4de",
  text: "#1a1a2e",
  textMuted: "#5c5c78",
  textDim: "#8c8ca0",
  accent: "#4f46e5",
  positive: "#16a34a",
  positiveMuted: "#dcfce7",
  negative: "#dc2626",
  negativeMuted: "#fee2e2",
  neutralSent: "#ca8a04",
  neutralMuted: "#fef9c3",
  labsYellow: "#b45309",
  labsYellowBg: "#fef3c7",
};

const satisfactionColors: Record<string, string> = {
  "1": "#dc2626", "2": "#f97316", "3": "#ca8a04", "4": "#65a30d", "5": "#16a34a",
};

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 9, color: colors.text, backgroundColor: colors.bg },
  // Cover
  cover: { backgroundColor: colors.accent, borderRadius: 8, padding: 30, alignItems: "center", marginBottom: 16 },
  coverSubtitle: { fontSize: 8, color: "#ffffff", opacity: 0.7, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 },
  coverTitle: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#ffffff", marginBottom: 4 },
  coverHotel: { fontSize: 14, color: "#ffffff", opacity: 0.9, marginBottom: 6 },
  coverPeriod: { fontSize: 10, color: "#ffffff", opacity: 0.7 },
  // Sections
  section: { backgroundColor: colors.surface, borderRadius: 8, border: `1px solid ${colors.border}`, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: colors.textDim, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 },
  // Text
  body: { fontSize: 9, lineHeight: 1.5, color: colors.text },
  bold: { fontFamily: "Helvetica-Bold" },
  muted: { color: colors.textMuted, fontSize: 8 },
  dim: { color: colors.textDim, fontSize: 7 },
  // Grid
  row: { flexDirection: "row", gap: 8 },
  col: { flex: 1 },
  // Metric cards
  metricCard: { backgroundColor: colors.surface2, borderRadius: 6, padding: 10, alignItems: "center", flex: 1 },
  metricValue: { fontSize: 18, fontFamily: "Helvetica-Bold", color: colors.accent },
  metricLabel: { fontSize: 7, color: colors.textDim, textAlign: "center", marginTop: 3 },
  // Info box
  infoBox: { backgroundColor: colors.surface2, borderRadius: 6, padding: 8, marginTop: 8 },
  infoText: { fontSize: 7, color: colors.textDim, lineHeight: 1.4 },
  // Derivation row
  derivRow: { flexDirection: "row", alignItems: "flex-start", backgroundColor: colors.surface2, borderRadius: 6, padding: 8, marginBottom: 4, gap: 8 },
  derivCount: { width: 28, textAlign: "right" as const, fontSize: 10, fontFamily: "Helvetica-Bold", color: colors.neutralSent },
  derivText: { flex: 1, fontSize: 8, color: colors.text },
  derivPct: { width: 32, textAlign: "right" as const, fontSize: 8, color: colors.textMuted },
  // Success case
  successCard: { backgroundColor: colors.positiveMuted, borderRadius: 6, padding: 10, marginBottom: 6 },
  // Improvement
  improvRow: { flexDirection: "row", gap: 8, backgroundColor: colors.surface2, borderRadius: 6, padding: 8, marginBottom: 4 },
  improvBadge: { fontSize: 6, fontFamily: "Helvetica-Bold", textTransform: "uppercase", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  // Bar
  barContainer: { height: 4, backgroundColor: colors.surface3, borderRadius: 2, marginTop: 4, marginBottom: 2 },
  bar: { height: 4, borderRadius: 2 },
  // Conclusion
  conclusion: { backgroundColor: "#eef2ff", borderRadius: 8, border: `1px solid ${colors.accent}33`, padding: 16, alignItems: "center", marginBottom: 12 },
});

function MetricCircle({ value, color, label, sublabel }: { value: number; color: string; label: string; sublabel?: string }) {
  const pct = Math.round(value * 100);
  return (
    <View style={[s.metricCard, { alignItems: "center" }]}>
      <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 4, borderColor: color, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color }}>{pct}%</Text>
      </View>
      <Text style={[s.dim, { marginTop: 4, textAlign: "center" as const }]}>{label}</Text>
      {sublabel && <Text style={s.dim}>{sublabel}</Text>}
    </View>
  );
}

function automationLabel(rate: number): string {
  if (rate >= 0.8) return "Excelente";
  if (rate >= 0.6) return "Buena";
  return "Con alto potencial de crecimiento";
}

export function ReportPDF({ data }: { data: PilotReportData }) {
  const { meta, metrics, success_cases, improvement_opportunities } = data;

  return (
    <Document>
      {/* Page 1: Cover + Summary + Metrics */}
      <Page size="A4" style={s.page}>
        {/* Cover */}
        <View style={s.cover}>
          <Text style={s.coverSubtitle}>myHotel Labs</Text>
          <Text style={s.coverTitle}>Reporte Piloto Concierge</Text>
          <Text style={s.coverHotel}>{meta.hotel_name}</Text>
          <Text style={s.coverPeriod}>{meta.period_start} — {meta.period_end}</Text>
        </View>

        {/* Executive Summary */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Resumen Ejecutivo</Text>
          <Text style={s.body}>
            Durante el período de evaluación, Concierge ({meta.concierge_name}) atendió{" "}
            <Text style={s.bold}>{metrics.interaction_rate.responded}</Text> conversaciones activas de{" "}
            <Text style={s.bold}>{metrics.interaction_rate.contacted}</Text> huéspedes contactados.
          </Text>
          <Text style={[s.body, { marginTop: 4 }]}>
            Se resolvieron automáticamente el <Text style={s.bold}>{Math.round(metrics.automation_rate.rate * 100)}%</Text> de los mensajes ({automationLabel(metrics.automation_rate.rate)}).
          </Text>
          <Text style={[s.body, { marginTop: 4 }]}>
            Tiempo de respuesta promedio: <Text style={s.bold}>{metrics.response_time.bot_median_seconds} segundos</Text> vs {metrics.response_time.human_benchmark_minutes} min benchmark humano. Ahorro: <Text style={s.bold}>{metrics.time_saved.hours} horas</Text>.
          </Text>
          <Text style={[s.body, { marginTop: 4 }]}>
            El <Text style={s.bold}>{Math.round(metrics.inferred_satisfaction.positive_rate * 100)}%</Text> de los huéspedes mostró satisfacción positiva (score 4 o 5).
          </Text>
        </View>

        {/* Main metrics */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Métricas Principales</Text>
          <View style={[s.row, { marginBottom: 10 }]}>
            <MetricCircle
              value={metrics.interaction_rate.overall}
              color={colors.accent}
              label="Tasa de Interacción"
              sublabel={`${metrics.interaction_rate.responded} / ${metrics.interaction_rate.contacted}`}
            />
            <MetricCircle
              value={metrics.automation_rate.rate}
              color={colors.positive}
              label="Tasa de Automatización"
              sublabel={`${metrics.automation_rate.not_derived} / ${metrics.automation_rate.total_ia_messages} msgs`}
            />
            <MetricCircle
              value={metrics.inferred_satisfaction.positive_rate}
              color={colors.positive}
              label="Satisfacción Positiva"
            />
          </View>
          <View style={s.row}>
            <View style={s.metricCard}>
              <Text style={s.metricValue}>{metrics.response_time.bot_median_seconds}<Text style={[s.muted, { fontSize: 8 }]}> seg</Text></Text>
              <Text style={s.metricLabel}>Tiempo de respuesta {meta.concierge_name}</Text>
            </View>
            <View style={s.metricCard}>
              <Text style={s.metricValue}>{metrics.time_saved.hours}<Text style={[s.muted, { fontSize: 8 }]}> hrs</Text></Text>
              <Text style={s.metricLabel}>Tiempo ahorrado</Text>
            </View>
            <View style={s.metricCard}>
              <Text style={s.metricValue}>{meta.active_conversations}</Text>
              <Text style={s.metricLabel}>Conversaciones activas</Text>
            </View>
          </View>
        </View>

        {/* Interaction by origin */}
        {metrics.interaction_by_origin.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Interacción por Origen</Text>
            {metrics.interaction_by_origin.map((o, i) => (
              <View key={i} style={{ marginBottom: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 8, color: colors.text }}>{o.origin}</Text>
                  <Text style={{ fontSize: 8, color: colors.textMuted }}>{Math.round(o.rate * 100)}% ({o.responded}/{o.contacted})</Text>
                </View>
                <View style={s.barContainer}>
                  <View style={[s.bar, { width: `${Math.round(o.rate * 100)}%`, backgroundColor: colors.accent }]} />
                </View>
              </View>
            ))}
          </View>
        )}
      </Page>

      {/* Page 2: Satisfaction + Topics + Derivations */}
      <Page size="A4" style={s.page}>
        {/* Satisfaction */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Satisfacción Inferida</Text>
          <View style={{ flexDirection: "row", height: 20, borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
            {["1", "2", "3", "4", "5"].map((score) => {
              const count = metrics.inferred_satisfaction.distribution[score] || 0;
              const total = Object.values(metrics.inferred_satisfaction.distribution).reduce((a, b) => a + b, 0);
              const pct = total > 0 ? (count / total) * 100 : 0;
              if (pct === 0) return null;
              return (
                <View key={score} style={{ width: `${pct}%`, backgroundColor: satisfactionColors[score], justifyContent: "center", alignItems: "center", minWidth: 12 }}>
                  <Text style={{ fontSize: 7, color: "#ffffff", fontFamily: "Helvetica-Bold" }}>{pct >= 8 ? score : ""}</Text>
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {["1", "2", "3", "4", "5"].map((score) => {
              const count = metrics.inferred_satisfaction.distribution[score] || 0;
              const total = Object.values(metrics.inferred_satisfaction.distribution).reduce((a, b) => a + b, 0);
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <View key={score} style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: colors.text }}>{pct}%</Text>
                  <Text style={{ fontSize: 6, color: colors.textDim }}>Score {score} ({count})</Text>
                </View>
              );
            })}
          </View>
          <View style={s.infoBox}>
            <Text style={s.infoText}>Score inferido por IA: 5=muy satisfecho, 4=satisfecho, 3=neutral, 2=frustrado, 1=muy insatisfecho.</Text>
          </View>
        </View>

        {/* Top Topics */}
        {metrics.top_topics.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Temas Más Consultados</Text>
            {metrics.top_topics.map((t, i) => (
              <View key={i} style={{ marginBottom: 5 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 8, color: colors.text }}>{t.topic}</Text>
                  <Text style={{ fontSize: 8, color: colors.textMuted }}>{Math.round(t.pct * 100)}% ({t.count})</Text>
                </View>
                <View style={s.barContainer}>
                  <View style={[s.bar, { width: `${Math.round((t.pct / Math.max(...metrics.top_topics.map(x => x.pct), 0.01)) * 100)}%`, backgroundColor: colors.accent }]} />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Derivation Analysis */}
        {metrics.derivation_rate.top_reasons.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Análisis de Derivaciones</Text>
            <View style={[s.row, { marginBottom: 8 }]}>
              <View style={s.metricCard}>
                <Text style={[s.metricValue, { color: colors.text, fontSize: 14 }]}>{metrics.automation_rate.total_ia_messages}</Text>
                <Text style={s.metricLabel}>Total mensajes IA</Text>
              </View>
              <View style={[s.metricCard, { backgroundColor: colors.positiveMuted }]}>
                <Text style={[s.metricValue, { color: colors.positive, fontSize: 14 }]}>{metrics.automation_rate.not_derived}</Text>
                <Text style={s.metricLabel}>Resueltos directamente</Text>
              </View>
              <View style={[s.metricCard, { backgroundColor: colors.neutralMuted }]}>
                <Text style={[s.metricValue, { color: colors.neutralSent, fontSize: 14 }]}>{metrics.automation_rate.derived}</Text>
                <Text style={s.metricLabel}>Derivados a humano</Text>
              </View>
            </View>
            <Text style={[s.bold, { fontSize: 8, marginBottom: 4 }]}>Derivaciones por tema</Text>
            {(metrics.derivation_rate.by_topic ?? []).map((t, i) => (
              <View key={i} style={{ marginBottom: 6 }}>
                <View style={s.derivRow}>
                  <Text style={s.derivCount}>{t.count}</Text>
                  <Text style={[s.derivText, { fontWeight: 700 }]}>{t.topic}</Text>
                  <Text style={s.derivPct}>{Math.round(t.pct * 100)}%</Text>
                </View>
                {t.reasons.map((r, j) => (
                  <View key={j} style={{ flexDirection: "row", paddingLeft: 24, marginTop: 1 }}>
                    <Text style={{ fontSize: 7, color: colors.textDim, width: 24 }}>{r.count}×</Text>
                    <Text style={{ fontSize: 7, color: colors.textMuted, flex: 1 }}>{r.reason}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}
      </Page>

      {/* Page 3: Success cases + Improvements + Conclusion */}
      <Page size="A4" style={s.page}>
        {/* Success Cases */}
        {success_cases.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Casos de Éxito</Text>
            {success_cases.map((sc, i) => (
              <View key={i} style={s.successCard}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={{ fontSize: 8, color: colors.text, flex: 1 }}>{sc.summary}</Text>
                  <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: colors.positive, marginLeft: 8 }}>{sc.satisfaction_score}/5</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 4, flexWrap: "wrap" }}>
                  {sc.topics.map((t, j) => (
                    <Text key={j} style={{ fontSize: 6, backgroundColor: colors.surface2, color: colors.textMuted, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 2 }}>{t}</Text>
                  ))}
                </View>
                <Link src={sc.url} style={{ fontSize: 6, color: colors.accent, marginTop: 4 }}>Ver conversación →</Link>
              </View>
            ))}
          </View>
        )}

        {/* Improvement Opportunities */}
        {improvement_opportunities.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Oportunidades de Mejora</Text>
            {improvement_opportunities.map((opp, i) => (
              <View key={i} style={s.improvRow}>
                <Text style={[s.improvBadge, {
                  backgroundColor: opp.owner === "hotel" ? colors.neutralMuted : colors.labsYellowBg,
                  color: opp.owner === "hotel" ? colors.neutralSent : colors.labsYellow,
                }]}>
                  {opp.owner === "hotel" ? "Hotel" : "Roadmap"}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 8, color: colors.text }}>{opp.detail}</Text>
                  <Text style={{ fontSize: 7, color: colors.textDim, marginTop: 2 }}>{opp.impact}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Conclusion */}
        <View style={s.conclusion}>
          <Text style={[s.sectionTitle, { color: colors.accent }]}>Conclusión</Text>
          <Text style={[s.body, { textAlign: "center" }]}>
            Concierge ({meta.concierge_name}) demostró ser una herramienta efectiva durante el piloto en{" "}
            <Text style={s.bold}>{meta.hotel_name}</Text>, resolviendo el{" "}
            <Text style={s.bold}>{Math.round(metrics.automation_rate.rate * 100)}%</Text> de las consultas automáticamente y ahorrando{" "}
            <Text style={s.bold}>{metrics.time_saved.hours} horas</Text> de trabajo manual. Recomendamos avanzar con la contratación para maximizar el potencial de automatización y mejorar la experiencia de los huéspedes.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
