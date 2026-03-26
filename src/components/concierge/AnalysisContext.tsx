"use client";

import { createContext, useContext, useState, useRef, useCallback, ReactNode } from "react";
import { aggregateReport } from "@/lib/concierge/aggregator";
import type {
  CSVParseResult,
  UploadFormData,
  AnalysisProgress,
  ConversationAnalysis,
  PilotReportData,
} from "@/lib/concierge/types";

interface AnalysisState {
  progress: AnalysisProgress | null;
  reportData: PilotReportData | null;
  isProcessing: boolean;
  startAnalysis: (parseResult: CSVParseResult, formData: UploadFormData) => void;
  cancelAnalysis: () => void;
  setReportData: (data: PilotReportData | null) => void;
  setProgress: (progress: AnalysisProgress | null) => void;
}

const AnalysisContext = createContext<AnalysisState | null>(null);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [reportData, setReportData] = useState<PilotReportData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const saveReport = async (report: PilotReportData) => {
    try {
      await fetch("/api/concierge/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_data: report }),
      });
    } catch (err) {
      console.error("Failed to save report:", err);
    }
  };

  const startAnalysis = useCallback(
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
                if (event.analyses) {
                  allAnalyses.push(...event.analyses);
                }
                setProgress((prev) => prev ? { ...prev, message: `Lote ${event.batch} completado (${event.count} conversaciones analizadas)` } : prev);
              } else if (event.type === "batch_error") {
                console.warn(`Batch ${event.batch} error:`, event.error);
                setProgress((prev) => prev ? { ...prev, message: `Lote ${event.batch} falló: ${event.error}. Continuando...` } : prev);
              } else if (event.type === "complete") {
                if (event.analyses && allAnalyses.length === 0) {
                  allAnalyses = event.analyses;
                }
              }
            } catch { /* skip */ }
          }
        }

        // Flush remaining buffer after stream ends
        if (buffer.trim()) {
          const remaining = buffer.trim();
          if (remaining.startsWith("data: ")) {
            try {
              const event = JSON.parse(remaining.slice(6));
              if (event.type === "batch_complete" && event.analyses) {
                allAnalyses.push(...event.analyses);
              }
            } catch { /* skip incomplete data */ }
          }
        }

        setProgress({ stage: "aggregating", current_batch: 0, total_batches: 0, message: "Generando reporte final..." });

        const report = aggregateReport(parseResult.conversations, allAnalyses, formData, parseResult.customer_id, parseResult.customer_name);

        setReportData(report);
        setProgress({ stage: "done", current_batch: 0, total_batches: 0, message: "Reporte generado exitosamente." });

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
    []
  );

  const cancelAnalysis = useCallback(() => {
    abortRef.current?.abort();
    setIsProcessing(false);
    setProgress(null);
  }, []);

  return (
    <AnalysisContext.Provider
      value={{
        progress,
        reportData,
        isProcessing,
        startAnalysis,
        cancelAnalysis,
        setReportData,
        setProgress,
      }}
    >
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis must be used within AnalysisProvider");
  return ctx;
}
