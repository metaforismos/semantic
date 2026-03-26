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

// Poll the server for job completion when the stream breaks
async function pollJobUntilComplete(jobId: string, onProgress: (msg: string) => void): Promise<ConversationAnalysis[]> {
  const POLL_INTERVAL = 5_000; // 5 seconds
  const MAX_POLLS = 120; // 10 minutes max

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));

    try {
      const res = await fetch(`/api/concierge/analyze/status?job_id=${jobId}`);
      if (!res.ok) continue;

      const job = await res.json();

      if (job.status === "complete") {
        console.log(`[Analysis] Job ${jobId} recovered: ${job.analyses.length} analyses`);
        return job.analyses;
      }

      // Still running — update progress
      onProgress(`Servidor procesando... lote ${job.completed_batches} de ${job.total_batches} (reconectando automáticamente)`);
    } catch {
      // Network error during poll — keep trying
    }
  }

  throw new Error("El servidor no completó el análisis a tiempo.");
}

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

        // Only send active conversations to reduce payload size significantly
        const activeConversations = parseResult.conversations.filter((c) => c.is_active);
        const serializedConversations = activeConversations.map((c) => ({
          ...c,
          messages: c.messages.map((m) => ({
            ...m,
            sent_at: m.sent_at instanceof Date ? m.sent_at.toISOString() : m.sent_at,
          })),
        }));

        const payload = JSON.stringify({ conversations: serializedConversations });
        const payloadSizeMB = (payload.length / (1024 * 1024)).toFixed(2);
        console.log(`[Analysis] Sending ${serializedConversations.length} conversations (${payloadSizeMB} MB)`);

        const response = await fetch("/api/concierge/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          throw new Error(`Error del servidor: ${response.status} ${errorText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No se pudo leer la respuesta");

        const decoder = new TextDecoder();
        let allAnalyses: ConversationAnalysis[] = [];
        let buffer = "";
        let jobId: string | null = null;
        let streamCompleted = false;

        try {
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
                if (event.type === "job_id") {
                  jobId = event.job_id;
                  console.log(`[Analysis] Job ID: ${jobId}`);
                } else if (event.type === "progress") {
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
                  streamCompleted = true;
                  if (event.analyses && allAnalyses.length === 0) {
                    allAnalyses = event.analyses;
                  }
                }
              } catch { /* skip */ }
            }
          }
        } catch (streamErr) {
          // Stream broke mid-way (ERR_HTTP2_PROTOCOL_ERROR, network error, etc.)
          // If we have a job ID, poll the server for completion
          if (jobId && !abortRef.current?.signal.aborted) {
            console.warn(`[Analysis] Stream broke after receiving ${allAnalyses.length} analyses. Recovering via polling...`);
            setProgress({ stage: "llm", current_batch: 0, total_batches: 0, message: "Conexión interrumpida. Recuperando del servidor..." });

            const recoveredAnalyses = await pollJobUntilComplete(jobId, (msg) => {
              setProgress({ stage: "llm", current_batch: 0, total_batches: 0, message: msg });
            });

            allAnalyses = recoveredAnalyses;
            streamCompleted = true;
          } else {
            throw streamErr;
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

        // If stream ended without "complete" event but we have a job ID, try recovery
        if (!streamCompleted && jobId && allAnalyses.length === 0) {
          console.warn(`[Analysis] Stream ended without completion. Recovering via polling...`);
          setProgress({ stage: "llm", current_batch: 0, total_batches: 0, message: "Esperando resultados del servidor..." });

          const recoveredAnalyses = await pollJobUntilComplete(jobId, (msg) => {
            setProgress({ stage: "llm", current_batch: 0, total_batches: 0, message: msg });
          });
          allAnalyses = recoveredAnalyses;
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
