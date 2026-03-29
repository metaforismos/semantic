"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSVParseResult, CSVValidationError } from "@/lib/concierge/types";
import { parseCSV } from "@/lib/concierge/csv-parser";
import { parsePromptCSV } from "@/lib/concierge/prompt-parser";
import type { PipelinePrompt, PromptParseResult, PromptValidationError, QualityUploadFormData } from "@/lib/concierge/quality-types";

interface QualityUploadFormProps {
  onParsed: (
    convResult: CSVParseResult,
    promptResult: PromptParseResult,
    formData: QualityUploadFormData
  ) => void;
  disabled: boolean;
}

export function QualityUploadForm({ onParsed, disabled }: QualityUploadFormProps) {
  const convInputRef = useRef<HTMLInputElement>(null);
  const promptInputRef = useRef<HTMLInputElement>(null);

  // Conversations CSV state
  const [convDragOver, setConvDragOver] = useState(false);
  const [convFileName, setConvFileName] = useState<string | null>(null);
  const [convResult, setConvResult] = useState<CSVParseResult | null>(null);
  const [convErrors, setConvErrors] = useState<CSVValidationError[]>([]);

  // Prompts state
  const [promptDragOver, setPromptDragOver] = useState(false);
  const [promptFileName, setPromptFileName] = useState<string | null>(null);
  const [promptResult, setPromptResult] = useState<PromptParseResult | null>(null);
  const [promptErrors, setPromptErrors] = useState<PromptValidationError[]>([]);
  const [storedPromptsLoading, setStoredPromptsLoading] = useState(true);
  const [storedPromptsSource, setStoredPromptsSource] = useState<"db" | "csv" | null>(null);
  const [showPromptUpload, setShowPromptUpload] = useState(false);

  // Form fields
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [notes, setNotes] = useState("");

  // Auto-load stored prompts on mount
  useEffect(() => {
    async function loadStoredPrompts() {
      try {
        const res = await fetch("/api/concierge/prompts");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        const prompts: PipelinePrompt[] = data.prompts || [];

        if (prompts.length > 0) {
          const activePrompts = prompts.filter((p) => p.status === "Active");
          if (activePrompts.length > 0) {
            setPromptResult({ prompts, active_prompts: activePrompts, warnings: [] });
            setStoredPromptsSource("db");
          }
        }
      } catch (err) {
        console.warn("[QualityUpload] Could not load stored prompts:", err);
      } finally {
        setStoredPromptsLoading(false);
      }
    }
    loadStoredPrompts();
  }, []);

  const handleConvFile = useCallback((file: File) => {
    setConvFileName(file.name);
    setConvErrors([]);
    setConvResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const { result, errors } = parseCSV(content, { allowMultiHotel: true });

      const blocking = errors.filter((e) => e.type === "blocking");
      if (blocking.length > 0) {
        setConvErrors(blocking);
        return;
      }

      if (result) {
        setConvResult(result);
        setPeriodStart(result.period_start);
        setPeriodEnd(result.period_end);
        setConvErrors(errors.filter((e) => e.type === "warning"));
      }
    };
    reader.readAsText(file);
  }, []);

  const handlePromptFile = useCallback((file: File) => {
    setPromptFileName(file.name);
    setPromptErrors([]);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      const { result, errors } = parsePromptCSV(content);

      const blocking = errors.filter((e) => e.type === "blocking");
      if (blocking.length > 0) {
        setPromptErrors(blocking);
        return;
      }

      if (result) {
        setPromptResult(result);
        setPromptErrors(errors.filter((e) => e.type === "warning"));
        setStoredPromptsSource("csv");
        setShowPromptUpload(false);

        // Save to DB for future use
        try {
          await fetch("/api/concierge/prompts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompts: result.prompts }),
          });
          console.log("[QualityUpload] Prompts saved to DB");
        } catch (err) {
          console.warn("[QualityUpload] Could not save prompts to DB:", err);
        }
      }
    };
    reader.readAsText(file);
  }, []);

  const handleSubmit = () => {
    if (!convResult || !promptResult) return;
    onParsed(convResult, promptResult, {
      period_start: periodStart,
      period_end: periodEnd,
      notes,
    });
  };

  const convBlocking = convErrors.filter((e) => e.type === "blocking");
  const convWarnings = convErrors.filter((e) => e.type === "warning");
  const promptBlocking = promptErrors.filter((e) => e.type === "blocking");
  const promptWarnings = promptErrors.filter((e) => e.type === "warning");
  const canSubmit = convResult && promptResult && convBlocking.length === 0 && promptBlocking.length === 0;

  // Estimate cost before running
  const costEstimate = (() => {
    if (!convResult || !promptResult) return null;

    const activeConvs = convResult.conversations.filter((c) => c.is_active);
    const numConvs = activeConvs.length;
    const BATCH_SIZE = 5;
    const numBatches = Math.ceil(numConvs / BATCH_SIZE);

    // Estimate system prompt tokens (~1 token per 4 chars)
    const systemPromptChars = promptResult.active_prompts.reduce(
      (sum, p) => sum + Math.min(p.system_template.length, 2000) + Math.min(p.user_template.length, 500), 0
    ) + 3000; // base prompt instructions
    const systemTokensPerBatch = Math.ceil(systemPromptChars / 4);

    // Estimate user message tokens (conversation text)
    const totalConvChars = activeConvs.reduce(
      (sum, c) => sum + c.messages.reduce((ms, m) => ms + (m.text?.length || 0) + 30, 0), 0
    );
    const convTokens = Math.ceil(totalConvChars / 4);

    // Output: ~400 tokens per conversation (dimensions JSON)
    const outputTokens = numConvs * 400;

    // Eval batches: system prompt repeated per batch + conv tokens spread across batches
    const totalInputTokens = (systemTokensPerBatch * numBatches) + convTokens;

    // Proposal call: ~2000 input + ~1500 output
    const proposalInputTokens = systemPromptChars / 4 + 2000;
    const proposalOutputTokens = 1500;

    // Claude Sonnet pricing: $3/MTok input, $15/MTok output
    const inputCost = ((totalInputTokens + proposalInputTokens) / 1_000_000) * 3;
    const outputCost = ((outputTokens + proposalOutputTokens) / 1_000_000) * 15;
    const totalCost = inputCost + outputCost;

    return {
      numConvs,
      numBatches,
      inputTokensK: Math.round((totalInputTokens + proposalInputTokens) / 1000),
      outputTokensK: Math.round((outputTokens + proposalOutputTokens) / 1000),
      totalCost,
    };
  })();

  return (
    <div className="space-y-5">
      {/* Conversations CSV */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-text-dim mb-2">
          1. Conversaciones CSV
        </label>
        <DropZone
          inputRef={convInputRef}
          dragOver={convDragOver}
          setDragOver={setConvDragOver}
          onFile={handleConvFile}
          fileName={convFileName}
          summary={convResult ? (
            <>
              {convResult.conversations.length} conversaciones ·{" "}
              {convResult.conversations.filter((c) => c.is_active).length} activas ·{" "}
              {new Set(convResult.conversations.map((c) => c.customer_id)).size} hotel(es)
            </>
          ) : null}
          placeholder="CSV de conversaciones (acepta múltiples hoteles)"
        />
        <ErrorList blocking={convBlocking} warnings={convWarnings} />
      </div>

      {/* Prompts section */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-text-dim mb-2">
          2. Prompts del Pipeline
        </label>

        {storedPromptsLoading ? (
          <div className="skeleton h-16 rounded-lg" />
        ) : promptResult && !showPromptUpload ? (
          /* Prompts loaded (from DB or CSV) */
          <div className="border border-positive/50 bg-positive-muted/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-positive">
                  <path d="M13.5 4.5L6.5 11.5L2.5 7.5" />
                </svg>
                <span className="text-sm font-medium text-positive">
                  {storedPromptsSource === "db" ? "Prompts cargados desde BD" : promptFileName || "Prompts cargados"}
                </span>
              </div>
              <button
                onClick={() => setShowPromptUpload(true)}
                className="text-[11px] font-medium text-accent-light hover:underline"
              >
                Actualizar
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {promptResult.active_prompts.map((p) => (
                <span
                  key={p.prompt_key}
                  className="text-[11px] font-mono bg-white/50 border border-positive/20 px-2 py-0.5 rounded"
                >
                  {p.prompt_key} <span className="text-text-dim">v{p.version}</span>
                </span>
              ))}
            </div>
            <div className="text-[10px] text-text-dim mt-2">
              {promptResult.active_prompts.length} activos de {promptResult.prompts.length} totales
              {storedPromptsSource === "db" && " · última versión de cada prompt"}
            </div>
          </div>
        ) : (
          /* No stored prompts or user wants to update */
          <>
            <DropZone
              inputRef={promptInputRef}
              dragOver={promptDragOver}
              setDragOver={setPromptDragOver}
              onFile={handlePromptFile}
              fileName={promptFileName}
              summary={null}
              placeholder="CSV de prompts (PromptKey, Version, Status, System_Template...)"
            />
            {showPromptUpload && (
              <button
                onClick={() => setShowPromptUpload(false)}
                className="text-[11px] text-text-dim hover:text-text mt-1"
              >
                Cancelar y usar prompts guardados
              </button>
            )}
          </>
        )}
        <ErrorList blocking={promptBlocking} warnings={promptWarnings} />
      </div>

      {/* Form fields — shown when both inputs are ready */}
      {canSubmit && (
        <div className="space-y-4 animate-fade-in">
          {/* Period */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-dim mb-1">Inicio período</label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full text-sm border border-border rounded px-3 py-2 bg-surface focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-dim mb-1">Fin período</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full text-sm border border-border rounded px-3 py-2 bg-surface focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-text-dim mb-1">Notas del PO (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full text-sm border border-border rounded px-3 py-2 bg-surface focus:outline-none focus:border-accent resize-none"
              placeholder="Contexto, hipótesis, foco de evaluación..."
            />
          </div>

          {/* Submit */}
          {/* Cost estimate */}
          {costEstimate && (
            <div className="border border-border rounded-lg p-3 bg-surface-2/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-text-dim">Costo estimado</span>
                <span className="text-sm font-bold text-accent">
                  ~${costEstimate.totalCost < 0.01 ? "<0.01" : costEstimate.totalCost.toFixed(2)} USD
                </span>
              </div>
              <div className="text-[10px] text-text-dim space-y-0.5">
                <div>{costEstimate.numConvs} conversaciones activas · {costEstimate.numBatches} lotes · {costEstimate.numBatches + 1} llamadas LLM</div>
                <div>~{costEstimate.inputTokensK}K input tokens · ~{costEstimate.outputTokensK}K output tokens · Claude Sonnet</div>
              </div>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={disabled}
            className="w-full py-2.5 bg-negative text-white text-sm font-medium rounded-lg hover:bg-negative/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {disabled ? "Evaluando..." : "Evaluar Calidad"}
          </button>
        </div>
      )}
    </div>
  );
}

// Reusable drop zone component
function DropZone({
  inputRef,
  dragOver,
  setDragOver,
  onFile,
  fileName,
  summary,
  placeholder,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  onFile: (file: File) => void;
  fileName: string | null;
  summary: React.ReactNode;
  placeholder: string;
}) {
  return (
    <div
      className={`border-2 border-dashed rounded-lg p-5 text-center transition-colors cursor-pointer ${
        dragOver
          ? "border-accent bg-accent/5"
          : fileName
          ? "border-positive/50 bg-positive-muted/30"
          : "border-border hover:border-accent/50"
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.txt"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      {fileName ? (
        <div>
          <div className="text-sm font-medium text-positive">{fileName}</div>
          {summary && <div className="text-xs text-text-muted mt-1">{summary}</div>}
        </div>
      ) : (
        <div>
          <div className="text-sm text-text-muted">{placeholder}</div>
          <div className="text-xs text-text-dim mt-1">Arrastra o haz clic para seleccionar</div>
        </div>
      )}
    </div>
  );
}

function ErrorList({
  blocking,
  warnings,
}: {
  blocking: { type: string; message: string }[];
  warnings: { type: string; message: string }[];
}) {
  return (
    <>
      {blocking.length > 0 && (
        <div className="bg-negative-muted border border-negative/20 rounded-lg p-3 mt-2">
          {blocking.map((e, i) => (
            <div key={i} className="text-sm text-negative">{e.message}</div>
          ))}
        </div>
      )}
      {warnings.length > 0 && (
        <div className="bg-neutral-muted border border-neutral-sent/20 rounded-lg p-3 mt-2">
          {warnings.map((e, i) => (
            <div key={i} className="text-sm text-neutral-sent">{e.message}</div>
          ))}
        </div>
      )}
    </>
  );
}
