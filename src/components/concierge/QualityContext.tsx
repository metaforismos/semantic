"use client";

import { createContext, useContext, useState, useRef, useCallback, ReactNode } from "react";
import type { CSVParseResult } from "@/lib/concierge/types";
import type {
  PromptParseResult,
  QualityEvalReport,
  QualityUploadFormData,
  QualityAnalysisProgress,
} from "@/lib/concierge/quality-types";

interface QualityState {
  progress: QualityAnalysisProgress | null;
  report: QualityEvalReport | null;
  savedEvalId: number | null;
  isProcessing: boolean;
  startAnalysis: (
    parseResult: CSVParseResult,
    promptResult: PromptParseResult,
    formData: QualityUploadFormData
  ) => void;
  cancelAnalysis: () => void;
  setReport: (data: QualityEvalReport | null) => void;
  setProgress: (progress: QualityAnalysisProgress | null) => void;
}

const QualityContext = createContext<QualityState | null>(null);

export function QualityProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<QualityAnalysisProgress | null>(null);
  const [report, setReport] = useState<QualityEvalReport | null>(null);
  const [savedEvalId, setSavedEvalId] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const saveReport = async (reportData: QualityEvalReport) => {
    try {
      const res = await fetch("/api/concierge/quality-eval/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: reportData }),
      });
      if (res.ok) {
        const data = await res.json();
        setSavedEvalId(data.id);
        console.log(`[QualityEval] Report saved with ID: ${data.id}`);
      }
    } catch (err) {
      console.error("[QualityEval] Failed to save report:", err);
    }
  };

  const startAnalysis = useCallback(
    async (
      parseResult: CSVParseResult,
      promptResult: PromptParseResult,
      formData: QualityUploadFormData
    ) => {
      setIsProcessing(true);
      setReport(null);
      abortRef.current = new AbortController();

      try {
        setProgress({ stage: "analyzing", current_batch: 0, total_batches: 0, message: "Iniciando evaluación de calidad..." });

        const activeConversations = parseResult.conversations.filter((c) => c.is_active);
        const serializedConversations = activeConversations.map((c) => ({
          ...c,
          messages: c.messages.map((m) => ({
            ...m,
            sent_at: m.sent_at instanceof Date ? m.sent_at.toISOString() : m.sent_at,
          })),
        }));

        const payload = JSON.stringify({
          conversations: serializedConversations,
          active_prompts: promptResult.active_prompts,
          form_data: formData,
        });

        const payloadSizeMB = (payload.length / (1024 * 1024)).toFixed(2);
        console.log(`[QualityEval] Sending ${serializedConversations.length} conversations, ${promptResult.active_prompts.length} prompts (${payloadSizeMB} MB)`);

        const response = await fetch("/api/concierge/quality-eval", {
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
                  stage: event.stage || "analyzing",
                  current_batch: event.current_batch,
                  total_batches: event.total_batches,
                  message: event.message,
                });
              } else if (event.type === "batch_complete") {
                setProgress((prev) => prev ? {
                  ...prev,
                  message: `Lote ${event.batch} completado (${event.count} conversaciones evaluadas)`,
                } : prev);
              } else if (event.type === "batch_error") {
                console.warn(`Batch ${event.batch} error:`, event.error);
                setProgress((prev) => prev ? {
                  ...prev,
                  message: `Lote ${event.batch} falló: ${event.error}. Continuando...`,
                } : prev);
              } else if (event.type === "proposals_complete") {
                setProgress((prev) => prev ? {
                  ...prev,
                  stage: "proposing",
                  message: `${event.count} propuestas generadas.`,
                } : prev);
              } else if (event.type === "proposals_error") {
                console.warn("Proposals error:", event.error);
              } else if (event.type === "report") {
                setReport(event.report);
                setProgress({ stage: "done", current_batch: 0, total_batches: 0, message: "Evaluación completada." });
                saveReport(event.report);
              } else if (event.type === "complete") {
                setProgress({ stage: "done", current_batch: 0, total_batches: 0, message: "Evaluación completada." });
              }
            } catch { /* skip malformed SSE */ }
          }
        }

        // Flush remaining buffer
        if (buffer.trim() && buffer.trim().startsWith("data: ")) {
          try {
            const event = JSON.parse(buffer.trim().slice(6));
            if (event.type === "report") {
              setReport(event.report);
              setProgress({ stage: "done", current_batch: 0, total_batches: 0, message: "Evaluación completada." });
              saveReport(event.report);
            }
          } catch { /* skip */ }
        }
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
    <QualityContext.Provider
      value={{ progress, report, savedEvalId, isProcessing, startAnalysis, cancelAnalysis, setReport, setProgress }}
    >
      {children}
    </QualityContext.Provider>
  );
}

export function useQualityAnalysis() {
  const ctx = useContext(QualityContext);
  if (!ctx) throw new Error("useQualityAnalysis must be used within QualityProvider");
  return ctx;
}
