"use client";

import { useState, useEffect } from "react";
import { UploadForm } from "@/components/concierge/UploadForm";
import { ReportPreview } from "@/components/concierge/ReportPreview";
import { ProgressBar } from "@/components/concierge/ProgressBar";
import { useAnalysis } from "@/components/concierge/AnalysisContext";
import { exportToPDF } from "@/lib/concierge/pdf-export";
import type { PilotReportData } from "@/lib/concierge/types";

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
  const { progress, reportData, isProcessing, startAnalysis, cancelAnalysis, setReportData, setProgress } = useAnalysis();
  const [jsonCopied, setJsonCopied] = useState(false);
  const [history, setHistory] = useState<ReportSummary[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Load history on mount
  useEffect(() => {
    fetch("/api/concierge/reports")
      .then((r) => r.json())
      .then((data) => setHistory(data.reports || []))
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, []);

  // Refresh history when a report finishes generating
  useEffect(() => {
    if (progress?.stage === "done" && reportData) {
      refreshHistory();
    }
  }, [progress?.stage, reportData]);

  const refreshHistory = () => {
    fetch("/api/concierge/reports")
      .then((r) => r.json())
      .then((data) => setHistory(data.reports || []))
      .catch(() => {});
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
    <div className="py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-lg font-bold text-text">Pilot Report</h1>
          <p className="text-xs text-text-dim mt-0.5">
            Genera un reporte de evaluación del piloto de Concierge a partir del CSV de mensajes.
          </p>
        </div>

        {!reportData ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left panel: Upload */}
            <div className="lg:sticky lg:top-6 lg:self-start space-y-4">
              <div className="bg-surface border border-border rounded-xl p-5">
                <h2 className="text-sm font-semibold text-text mb-4">Datos del Piloto</h2>
                <UploadForm onParsed={startAnalysis} disabled={isProcessing} />
                {isProcessing && (
                  <button onClick={cancelAnalysis} className="w-full mt-3 py-2 bg-negative/10 text-negative text-xs font-medium rounded-lg hover:bg-negative/20 transition-colors">
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
  );
}
