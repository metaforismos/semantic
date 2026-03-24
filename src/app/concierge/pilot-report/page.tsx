"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { UploadForm } from "@/components/concierge/UploadForm";
import { ReportPreview } from "@/components/concierge/ReportPreview";
import { ProgressBar } from "@/components/concierge/ProgressBar";
import { aggregateReport } from "@/lib/concierge/aggregator";
import { exportToPDF } from "@/lib/concierge/pdf-export";
import type {
  CSVParseResult,
  UploadFormData,
  AnalysisProgress,
  ConversationAnalysis,
  PilotReportData,
} from "@/lib/concierge/types";

interface ReportSummary {
  id: number;
  hotel_name: string;
  hotel_id: number;
  concierge_name: string;
  period_start: string;
  period_end: string;
  total_conversations: number;
  active_conversations: number;
  created_at: string;
}

export default function PilotReportPage() {
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [reportData, setReportData] = useState<PilotReportData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);
  const [history, setHistory] = useState<ReportSummary[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  // Load history on mount
  useEffect(() => {
    fetch("/api/concierge/reports")
      .then((r) => r.json())
      .then((data) => setHistory(data.reports || []))
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, []);

  const refreshHistory = () => {
    fetch("/api/concierge/reports")
      .then((r) => r.json())
      .then((data) => setHistory(data.reports || []))
      .catch(() => {});
  };

  const saveReport = async (report: PilotReportData) => {
    try {
      await fetch("/api/concierge/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_data: report }),
      });
      refreshHistory();
    } catch (err) {
      console.error("Failed to save report:", err);
    }
  };

  const loadReport = async (id: number) => {
    try {
      const res = await fetch(`/api/concierge/reports/${id}`);
      const data = await res.json();
      if (data.report?.report_data) {
        setReportData(data.report.report_data);
        setProgress({ stage: "done", current_batch: 0, total_batches: 0, message: "Reporte cargado." });
      }
    } catch (err) {
      console.error("Failed to load report:", err);
    }
  };

  const deleteReport = async (id: number) => {
    try {
      await fetch(`/api/concierge/reports/${id}`, { method: "DELETE" });
      refreshHistory();
    } catch (err) {
      console.error("Failed to delete report:", err);
    }
  };

  const handleGenerate = useCallback(
    async (parseResult: CSVParseResult, formData: UploadFormData) => {
      setIsProcessing(true);
      setReportData(null);
      abortRef.current = new AbortController();

      try {
        setProgress({ stage: "metrics", current_batch: 0, total_batches: 0, message: "Calculando métricas cuantitativas..." });
        setProgress({ stage: "llm", current_batch: 0, total_batches: 0, message: "Iniciando análisis con IA..." });

        const serializedConversations = parseResult.conversations.map((c) => ({
          ...c,
          messages: c.messages.map((m) => ({
            ...m,
            sent_at: m.sent_at instanceof Date ? m.sent_at.toISOString() : m.sent_at,
          })),
        }));

        const response = await fetch("/api/concierge/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversations: serializedConversations }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No se pudo leer la respuesta");

        const decoder = new TextDecoder();
        let allAnalyses: ConversationAnalysis[] = [];
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "progress") {
                setProgress({ stage: "llm", current_batch: event.current_batch, total_batches: event.total_batches, message: event.message });
              } else if (event.type === "batch_complete") {
                setProgress((prev) => prev ? { ...prev, message: `Lote ${event.batch} completado (${event.count} conversaciones analizadas)` } : prev);
              } else if (event.type === "batch_error") {
                console.warn(`Batch ${event.batch} error:`, event.error);
                setProgress((prev) => prev ? { ...prev, message: `Lote ${event.batch} falló: ${event.error}. Continuando...` } : prev);
              } else if (event.type === "complete") {
                allAnalyses = event.analyses;
              }
            } catch { /* skip */ }
          }
        }

        setProgress({ stage: "aggregating", current_batch: 0, total_batches: 0, message: "Generando reporte final..." });

        const report = aggregateReport(parseResult.conversations, allAnalyses, formData, parseResult.customer_id, parseResult.customer_name);

        setReportData(report);
        setProgress({ stage: "done", current_batch: 0, total_batches: 0, message: "Reporte generado exitosamente." });

        // Auto-save to database
        await saveReport(report);
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setProgress(null);
        } else {
          setProgress({ stage: "error", current_batch: 0, total_batches: 0, message: `Error: ${(err as Error).message}` });
        }
      } finally {
        setIsProcessing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleCancel = () => {
    abortRef.current?.abort();
    setIsProcessing(false);
    setProgress(null);
  };

  const handleExportPDF = async () => {
    if (!reportData) return;
    try {
      const fileName = `Reporte_Piloto_${reportData.meta.hotel_name.replace(/\s+/g, "_")}_${reportData.meta.period_end}.pdf`;
      await exportToPDF(reportData, fileName);
    } catch (err) {
      console.error("PDF export error:", err);
      alert(`Error generando PDF: ${(err as Error).message}. Intenta descargar el JSON.`);
    }
  };

  const handleExportJSON = () => {
    if (!reportData) return;
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Reporte_Piloto_${reportData.meta.hotel_name.replace(/\s+/g, "_")}_${reportData.meta.period_end}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen lg:ml-56">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-lg font-bold text-text">Pilot Report</h1>
          <p className="text-xs text-text-dim mt-0.5">
            Genera un reporte de evaluación del piloto de Concierge a partir del CSV de mensajes.
          </p>
        </div>

        {!reportData ? (
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
            {/* Left panel: Upload */}
            <div className="lg:sticky lg:top-6 lg:self-start space-y-4">
              <div className="bg-surface border border-border rounded-xl p-5">
                <h2 className="text-sm font-semibold text-text mb-4">Datos del Piloto</h2>
                <UploadForm onParsed={handleGenerate} disabled={isProcessing} />
                {isProcessing && (
                  <button onClick={handleCancel} className="w-full mt-3 py-2 bg-negative/10 text-negative text-xs font-medium rounded-lg hover:bg-negative/20 transition-colors">
                    Cancelar
                  </button>
                )}
              </div>
            </div>

            {/* Right panel: Progress + History */}
            <div>
              {progress && <ProgressBar progress={progress} />}

              {progress?.stage === "error" && (
                <div className="bg-negative-muted border border-negative/20 rounded-lg p-4 mt-4">
                  <div className="text-sm text-negative">{progress.message}</div>
                </div>
              )}

              {!progress && (
                <div>
                  {/* Report History */}
                  <div className="bg-surface border border-border rounded-xl p-5">
                    <h2 className="text-sm font-semibold text-text mb-4">Reportes Generados</h2>
                    {loadingHistory ? (
                      <div className="text-xs text-text-dim">Cargando historial...</div>
                    ) : history.length === 0 ? (
                      <div className="text-xs text-text-dim text-center py-8">
                        No hay reportes generados aún. Carga un CSV para crear el primero.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {history.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between bg-surface-2 rounded-lg p-3 hover:bg-surface-3 transition-colors"
                          >
                            <button
                              onClick={() => loadReport(r.id)}
                              className="flex-1 text-left"
                            >
                              <div className="text-sm font-medium text-text">{r.hotel_name}</div>
                              <div className="text-[10px] text-text-dim mt-0.5">
                                {new Date(r.period_start).toLocaleDateString("es-CL")} — {new Date(r.period_end).toLocaleDateString("es-CL")} · {r.active_conversations} activas / {r.total_conversations} total
                                {r.concierge_name && r.concierge_name !== "Concierge" && ` · ${r.concierge_name}`}
                              </div>
                              <div className="text-[10px] text-text-dim">
                                {new Date(r.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </button>
                            <button
                              onClick={() => deleteReport(r.id)}
                              className="p-1.5 text-text-dim hover:text-negative transition-colors shrink-0"
                              title="Eliminar reporte"
                            >
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M4 4l8 8M12 4l-8 8" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Export bar */}
            <div className="flex items-center justify-between bg-surface border border-border rounded-xl px-5 py-3">
              <div className="text-sm text-text">
                <strong>{reportData.meta.hotel_name}</strong>
                <span className="text-text-dim ml-2">{reportData.meta.period_start} — {reportData.meta.period_end}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={handleExportPDF} className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-light transition-colors">
                  Descargar PDF
                </button>
                <button onClick={handleExportJSON} className="px-4 py-2 bg-surface-2 border border-border text-text text-sm font-medium rounded-lg hover:bg-surface-3 transition-colors">
                  Descargar JSON
                </button>
                <button
                  onClick={() => { navigator.clipboard.writeText(JSON.stringify(reportData, null, 2)); setJsonCopied(true); setTimeout(() => setJsonCopied(false), 2000); }}
                  className="px-4 py-2 bg-surface-2 border border-border text-text text-sm font-medium rounded-lg hover:bg-surface-3 transition-colors"
                >
                  {jsonCopied ? "Copiado!" : "Copiar JSON"}
                </button>
                <a href="https://notebooklm.google.com/" target="_blank" rel="noopener noreferrer"
                  className="px-4 py-2 bg-surface-2 border border-border text-text text-sm font-medium rounded-lg hover:bg-surface-3 transition-colors inline-flex items-center gap-1.5">
                  NotebookLM
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-60">
                    <path d="M4.5 1.5h6v6" /><path d="M10.5 1.5L4 8" />
                  </svg>
                </a>
                <button onClick={() => { setReportData(null); setProgress(null); refreshHistory(); }}
                  className="px-4 py-2 text-text-muted text-sm font-medium rounded-lg hover:bg-surface-2 transition-colors">
                  Nuevo reporte
                </button>
              </div>
            </div>

            {/* NotebookLM tip */}
            <div className="bg-accent/5 border border-accent/15 rounded-lg px-4 py-2.5">
              <span className="text-xs text-text-muted">
                Copia el JSON y pégalo en <strong>NotebookLM</strong> para generar presentaciones, infografías y otros recursos a partir de los datos del reporte.
              </span>
            </div>

            {/* Full-width report */}
            <div className="animate-fade-in">
              <ReportPreview data={reportData} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
