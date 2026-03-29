"use client";

import { useCallback, useRef, useState } from "react";
import type { CSVParseResult, CSVValidationError } from "@/lib/concierge/types";
import { parseCSV } from "@/lib/concierge/csv-parser";
import { parsePromptCSV } from "@/lib/concierge/prompt-parser";
import type { PromptParseResult, PromptValidationError, QualityUploadFormData } from "@/lib/concierge/quality-types";

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

  // Prompts CSV state
  const [promptDragOver, setPromptDragOver] = useState(false);
  const [promptFileName, setPromptFileName] = useState<string | null>(null);
  const [promptResult, setPromptResult] = useState<PromptParseResult | null>(null);
  const [promptErrors, setPromptErrors] = useState<PromptValidationError[]>([]);

  // Form fields
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [notes, setNotes] = useState("");

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
    setPromptResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
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

      {/* Prompts CSV */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-text-dim mb-2">
          2. Prompts del Pipeline CSV
        </label>
        <DropZone
          inputRef={promptInputRef}
          dragOver={promptDragOver}
          setDragOver={setPromptDragOver}
          onFile={handlePromptFile}
          fileName={promptFileName}
          summary={promptResult ? (
            <>
              {promptResult.prompts.length} prompts · {promptResult.active_prompts.length} activos
            </>
          ) : null}
          placeholder="CSV de prompts (PromptKey, Version, Status, System_Template...)"
        />
        <ErrorList blocking={promptBlocking} warnings={promptWarnings} />
      </div>

      {/* Form fields — shown after both CSVs parsed */}
      {canSubmit && (
        <div className="space-y-4 animate-fade-in">
          {/* Active prompts summary */}
          <div>
            <label className="block text-xs font-medium text-text-dim mb-1">Prompts activos detectados</label>
            <div className="flex flex-wrap gap-1.5">
              {promptResult.active_prompts.map((p) => (
                <span
                  key={p.prompt_key}
                  className="text-[11px] font-mono bg-surface-2 border border-border px-2 py-0.5 rounded"
                >
                  {p.prompt_key} <span className="text-text-dim">v{p.version}</span>
                </span>
              ))}
            </div>
          </div>

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
          <button
            onClick={handleSubmit}
            disabled={disabled}
            className="w-full py-2.5 bg-negative text-white text-sm font-medium rounded-lg hover:bg-negative/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {disabled ? "Evaluando..." : "Evaluar Calidad"}
          </button>
          <p className="text-[10px] text-text-dim text-center">
            Usa Claude Sonnet. Costo estimado: ~$0.05-0.10 por conversación.
          </p>
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
