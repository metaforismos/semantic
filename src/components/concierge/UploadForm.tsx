"use client";

import { useCallback, useRef, useState } from "react";
import type { CSVParseResult, CSVValidationError, UploadFormData } from "@/lib/concierge/types";
import { parseCSV } from "@/lib/concierge/csv-parser";

interface UploadFormProps {
  onParsed: (result: CSVParseResult, formData: UploadFormData) => void;
  disabled: boolean;
}

export function UploadForm({ onParsed, disabled }: UploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<CSVParseResult | null>(null);
  const [errors, setErrors] = useState<CSVValidationError[]>([]);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [conciergeName, setConciergeName] = useState("");
  const [notes, setNotes] = useState("");

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    setErrors([]);
    setParseResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const { result, errors: parseErrors } = parseCSV(content);

      const blockingErrors = parseErrors.filter((e) => e.type === "blocking");
      if (blockingErrors.length > 0) {
        setErrors(blockingErrors);
        return;
      }

      if (result) {
        setParseResult(result);
        setPeriodStart(result.period_start);
        setPeriodEnd(result.period_end);
        setErrors(parseErrors.filter((e) => e.type === "warning"));

        // Try to auto-detect concierge name from first IA message
        // Look for patterns like "Soy X" or "I'm X" in IA messages
        for (const conv of result.conversations) {
          for (const msg of conv.messages) {
            if (msg.message_type === "IA" && msg.text) {
              const match = msg.text.match(/(?:soy|i'm|i am)\s+(\w+)/i);
              if (match && match[1].length > 1) {
                setConciergeName(match[1]);
                return;
              }
            }
          }
        }
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleSubmit = () => {
    if (!parseResult) return;
    onParsed(parseResult, {
      period_start: periodStart,
      period_end: periodEnd,
      concierge_name: conciergeName,
      notes,
    });
  };

  const blockingErrors = errors.filter((e) => e.type === "blocking");
  const warnings = errors.filter((e) => e.type === "warning");

  return (
    <div className="space-y-5">
      {/* Grafana link + filter reminder */}
      <div className="space-y-2">
        <a
          href="https://union.myhotel.cl/d/e56102e7-33cd-463f-b5d3-efa18b814801/mensajes?orgId=2&from=now%2FM&to=now%2FM&timezone=utc"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 py-2 bg-surface border border-border text-sm font-medium text-text rounded-lg hover:bg-surface-2 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 3H3v10h10v-3" />
            <path d="M9 2h5v5" />
            <path d="M14 2L7 9" />
          </svg>
          Ir a Grafana
        </a>
        <p className="text-[11px] text-text-muted leading-relaxed">
          Filtra por un solo hotel en Grafana antes de exportar el CSV. Si contiene múltiples hoteles, será rechazado.
        </p>
      </div>

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          dragOver
            ? "border-accent bg-accent/5"
            : fileName
            ? "border-positive/50 bg-positive-muted/30"
            : "border-border hover:border-accent/50"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.txt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        {fileName ? (
          <div>
            <div className="text-sm font-medium text-positive">{fileName}</div>
            {parseResult && (
              <div className="text-xs text-text-muted mt-1">
                {parseResult.conversations.length} conversaciones ·{" "}
                {parseResult.conversations.filter((c) => c.is_active).length} activas ·{" "}
                {parseResult.total_rows} mensajes
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="text-sm text-text-muted">
              Arrastra un archivo CSV aquí o haz clic para seleccionar
            </div>
            <div className="text-xs text-text-dim mt-1">Separador: tab, coma o punto y coma</div>
          </div>
        )}
      </div>

      {/* Errors */}
      {blockingErrors.length > 0 && (
        <div className="bg-negative-muted border border-negative/20 rounded-lg p-3">
          {blockingErrors.map((e, i) => (
            <div key={i} className="text-sm text-negative">
              {e.message}
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="bg-neutral-muted border border-neutral-sent/20 rounded-lg p-3">
          {warnings.map((e, i) => (
            <div key={i} className="text-sm text-neutral-sent">
              {e.message}
            </div>
          ))}
        </div>
      )}

      {/* Form fields — shown after successful parse */}
      {parseResult && (
        <div className="space-y-4 animate-fade-in">
          {/* Hotel info (read-only) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-dim mb-1">Hotel</label>
              <div className="text-sm font-medium bg-surface-2 rounded px-3 py-2">
                {parseResult.customer_name || `ID: ${parseResult.customer_id}`}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-dim mb-1">Customer ID</label>
              <div className="text-sm font-medium bg-surface-2 rounded px-3 py-2">
                {parseResult.customer_id}
              </div>
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

          {/* Concierge name */}
          <div>
            <label className="block text-xs font-medium text-text-dim mb-1">
              Nombre del Concierge
            </label>
            <input
              type="text"
              value={conciergeName}
              onChange={(e) => setConciergeName(e.target.value)}
              className="w-full text-sm border border-border rounded px-3 py-2 bg-surface focus:outline-none focus:border-accent"
              placeholder="Ej: Estrella, Ana, Concierge..."
            />
            <div className="text-[10px] text-text-dim mt-0.5">
              Se auto-detecta del CSV. Editable si no es correcto.
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-text-dim mb-1">
              Notas adicionales (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full text-sm border border-border rounded px-3 py-2 bg-surface focus:outline-none focus:border-accent resize-none"
              placeholder="Contexto adicional para el reporte..."
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={disabled || blockingErrors.length > 0}
            className="w-full py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {disabled ? "Generando reporte..." : "Generar Reporte"}
          </button>
        </div>
      )}
    </div>
  );
}
