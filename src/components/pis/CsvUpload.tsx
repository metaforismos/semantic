"use client";

import { useState, useRef } from "react";

interface BulkResult {
  total: number;
  created: number;
  errors: number;
  results: { line: number; id?: number; error?: string; title: string }[];
}

export function CsvUpload({ onComplete }: { onComplete: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [error, setError] = useState("");
  const [author, setAuthor] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Selecciona un archivo CSV o TSV");
      return;
    }

    setError("");
    setResult(null);
    setUploading(true);

    try {
      const text = await file.text();
      const res = await fetch("/api/pis/initiatives/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: text, author }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error en la carga");
      }

      const data: BulkResult = await res.json();
      setResult(data);
      if (data.created > 0) onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-text-dim">
          Carga masiva de iniciativas
        </div>

        <div className="text-xs text-text-muted leading-relaxed">
          Sube un archivo CSV o TSV con las columnas:{" "}
          <code className="bg-surface-2 px-1 py-0.5 rounded text-[11px]">
            Producto | Celula | Nombre iniciativa | Descripción | hipótesis | Jornadas
          </code>
          <br />
          Separado por tabulador (TSV) o coma (CSV). La primera fila debe ser el encabezado.
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-dim mb-1">
              Archivo
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt"
              className="w-full text-xs text-text-muted file:mr-2 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-surface-2 file:text-text-muted hover:file:bg-surface-3 file:cursor-pointer"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-dim mb-1">
              Autor (para todas)
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Nombre del autor"
              className="w-full px-3 py-1.5 bg-surface border border-border rounded-md text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        <button
          onClick={handleUpload}
          disabled={uploading}
          className="px-4 py-2 bg-accent text-white text-xs font-medium rounded-md hover:bg-accent-light transition-colors disabled:opacity-50"
        >
          {uploading ? "Subiendo..." : "Cargar iniciativas"}
        </button>

        {error && (
          <div className="bg-negative-muted text-negative text-xs px-3 py-2 rounded-md">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <div className="flex gap-4 text-xs">
              <span className="text-text-muted">
                Total: <strong>{result.total}</strong>
              </span>
              <span className="text-positive">
                Creadas: <strong>{result.created}</strong>
              </span>
              {result.errors > 0 && (
                <span className="text-negative">
                  Errores: <strong>{result.errors}</strong>
                </span>
              )}
            </div>
            {result.errors > 0 && (
              <div className="max-h-32 overflow-y-auto text-xs space-y-0.5">
                {result.results
                  .filter((r) => r.error)
                  .map((r) => (
                    <div
                      key={r.line}
                      className="text-negative bg-negative-muted/50 px-2 py-1 rounded"
                    >
                      Línea {r.line}: {r.error}{" "}
                      {r.title && `(${r.title})`}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
