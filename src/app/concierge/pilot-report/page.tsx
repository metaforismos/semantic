"use client";

import { useState, useCallback, useRef } from "react";
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

export default function PilotReportPage() {
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [reportData, setReportData] = useState<PilotReportData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleGenerate = useCallback(
    async (parseResult: CSVParseResult, formData: UploadFormData) => {
      setIsProcessing(true);
      setReportData(null);
      abortRef.current = new AbortController();

      try {
        // Step 1: Parsing done (already parsed by UploadForm)
        setProgress({
          stage: "metrics",
          current_batch: 0,
          total_batches: 0,
          message: "Calculando métricas cuantitativas...",
        });

        // Step 2: LLM analysis via SSE
        setProgress({
          stage: "llm",
          current_batch: 0,
          total_batches: 0,
          message: "Iniciando análisis con IA...",
        });

        // Serialize conversations for the API (Date objects → strings)
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

        if (!response.ok) {
          throw new Error(`Error del servidor: ${response.status}`);
        }

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
                setProgress({
                  stage: "llm",
                  current_batch: event.current_batch,
                  total_batches: event.total_batches,
                  message: event.message,
                });
              } else if (event.type === "complete") {
                allAnalyses = event.analyses;
              }
            } catch {
              // Skip malformed events
            }
          }
        }

        // Step 3: Aggregate
        setProgress({
          stage: "aggregating",
          current_batch: 0,
          total_batches: 0,
          message: "Generando reporte final...",
        });

        const report = aggregateReport(
          parseResult.conversations,
          allAnalyses,
          formData,
          parseResult.customer_id,
          parseResult.customer_name
        );

        setReportData(report);
        setProgress({
          stage: "done",
          current_batch: 0,
          total_batches: 0,
          message: "Reporte generado exitosamente.",
        });
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setProgress(null);
        } else {
          setProgress({
            stage: "error",
            current_batch: 0,
            total_batches: 0,
            message: `Error: ${(err as Error).message}`,
          });
        }
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  const handleCancel = () => {
    abortRef.current?.abort();
    setIsProcessing(false);
    setProgress(null);
  };

  const handleExportPDF = async () => {
    if (!reportData) return;
    const fileName = `Reporte_Piloto_${reportData.meta.hotel_name.replace(/\s+/g, "_")}_${reportData.meta.period_end}.pdf`;
    await exportToPDF("pilot-report", fileName);
  };

  const handleExportJSON = () => {
    if (!reportData) return;
    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: "application/json",
    });
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

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          {/* Left panel: Upload */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <div className="bg-surface border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-text mb-4">Datos del Piloto</h2>
              <UploadForm onParsed={handleGenerate} disabled={isProcessing} />

              {isProcessing && (
                <button
                  onClick={handleCancel}
                  className="w-full mt-3 py-2 bg-negative/10 text-negative text-xs font-medium rounded-lg hover:bg-negative/20 transition-colors"
                >
                  Cancelar
                </button>
              )}
            </div>

            {/* Export buttons */}
            {reportData && (
              <div className="mt-4 space-y-2 animate-fade-in">
                <button
                  onClick={handleExportPDF}
                  className="w-full py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-light transition-colors"
                >
                  Descargar PDF
                </button>
                <button
                  onClick={handleExportJSON}
                  className="w-full py-2.5 bg-surface border border-border text-text text-sm font-medium rounded-lg hover:bg-surface-2 transition-colors"
                >
                  Descargar JSON
                </button>
              </div>
            )}
          </div>

          {/* Right panel: Progress + Report */}
          <div>
            {progress && !reportData && <ProgressBar progress={progress} />}

            {progress?.stage === "error" && (
              <div className="bg-negative-muted border border-negative/20 rounded-lg p-4 mt-4">
                <div className="text-sm text-negative">{progress.message}</div>
              </div>
            )}

            {reportData && (
              <div className="animate-fade-in">
                <ReportPreview data={reportData} />
              </div>
            )}

            {!progress && !reportData && (
              <div className="flex items-center justify-center h-64 text-text-dim text-sm">
                Carga un CSV para generar el reporte.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
