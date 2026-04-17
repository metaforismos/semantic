"use client";

import { useCallback, useState } from "react";

type Detection = {
  rule_id: string;
  vendor: string;
  product: string;
  category: string;
  confidence: number;
  detected_via: string;
  evidence: { signature_type: string; pattern: string; matched: string }[];
};

type AnalyzeResponse = {
  url: string;
  final_url: string;
  status: number;
  duration_ms: number;
  title: string | null;
  meta_generator: string | null;
  detections: Detection[];
  script_srcs: string[];
  iframe_srcs: string[];
  outbound_links: string[];
  persisted?: { hotel_id: string; created: boolean } | null;
  persist_error?: string;
  error?: string;
};

const CATEGORY_LABEL: Record<string, string> = {
  cms: "CMS",
  booking_engine: "Booking engine",
  pms: "PMS",
  channel_mgr: "Channel manager",
  analytics: "Analytics",
  chat: "Chat",
  reviews: "Reviews",
  ads: "Ads",
  other: "Otros",
};

const CATEGORY_ORDER = [
  "booking_engine",
  "pms",
  "channel_mgr",
  "cms",
  "reviews",
  "chat",
  "ads",
  "analytics",
  "other",
];

const EXAMPLE_URLS = [
  "https://www.mandarinoriental.com/santiago",
  "https://www.hotelbidasoa.cl",
  "https://www.ayresdesalta.com.ar",
  "https://diegodealmagro.cl",
];

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    value >= 0.9 ? "bg-positive" : value >= 0.7 ? "bg-accent" : "bg-neutral-sent";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 bg-surface-2 rounded overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] tabular-nums text-text-dim">{pct}%</span>
    </div>
  );
}

export function TrackerSearch() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState<string | null>(null);

  const run = useCallback(
    async (targetUrl: string, save = false) => {
      const trimmed = targetUrl.trim();
      if (!trimmed) return;
      if (save) setSaving(true);
      else setLoading(true);
      setErr(null);
      setSavedOk(null);
      try {
        const r = await fetch("/api/tracker/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: trimmed, save }),
        });
        const data = (await r.json()) as AnalyzeResponse;
        if (!r.ok && !save) {
          setErr(data.error || `error_${r.status}`);
          setResult(null);
          return;
        }
        setResult(data);
        if (save && data.persisted) {
          setSavedOk(
            data.persisted.created
              ? `Hotel creado (${data.persisted.hotel_id.slice(0, 8)}…) y stack guardado.`
              : `Stack actualizado en hotel existente (${data.persisted.hotel_id.slice(0, 8)}…).`
          );
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "network_error");
      } finally {
        setLoading(false);
        setSaving(false);
      }
    },
    []
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    run(url);
  };

  const groupedDetections = (() => {
    if (!result) return [] as { category: string; items: Detection[] }[];
    const byCat = new Map<string, Detection[]>();
    for (const d of result.detections) {
      const arr = byCat.get(d.category) || [];
      arr.push(d);
      byCat.set(d.category, arr);
    }
    return CATEGORY_ORDER.filter((c) => byCat.has(c)).map((c) => ({
      category: c,
      items: byCat.get(c)!,
    }));
  })();

  const hasResult = Boolean(result && !result.error);
  const mainSignal =
    result?.detections.find((d) => d.category === "booking_engine") || null;

  return (
    <div className="space-y-6">
      <form
        onSubmit={onSubmit}
        className="border border-border rounded-md bg-surface p-4 space-y-3"
      >
        <div>
          <label className="text-[10px] uppercase tracking-wider text-text-dim">
            URL del hotel
          </label>
          <div className="flex gap-2 mt-1">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://ejemplo.cl"
              className="flex-1 px-3 py-2 text-sm border border-border rounded bg-surface-2 focus:outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="px-4 py-2 text-sm font-medium rounded bg-accent text-white hover:bg-accent-light disabled:opacity-50"
            >
              {loading ? "Analizando…" : "Analizar"}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-text-dim">
            <span>Ejemplos:</span>
            {EXAMPLE_URLS.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => {
                  setUrl(u);
                  run(u);
                }}
                className="px-1.5 py-0.5 border border-border rounded hover:border-border-light text-text-muted"
              >
                {u.replace(/^https?:\/\//, "")}
              </button>
            ))}
          </div>
        </div>
      </form>

      {err && (
        <div className="border border-negative/30 bg-negative-muted rounded-md px-4 py-3 text-sm text-negative">
          {err}
        </div>
      )}

      {hasResult && result && (
        <div className="space-y-4">
          <div className="border border-border rounded-md bg-surface p-4 flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-wider text-text-dim">
                Resultado
              </div>
              <div className="text-sm font-medium text-text truncate mt-1">
                {result.title || result.final_url}
              </div>
              <div className="text-xs text-text-dim mt-0.5 truncate">
                <a
                  href={result.final_url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-dotted hover:text-text-muted"
                >
                  {result.final_url}
                </a>
                {" · "}
                <span className="tabular-nums">{result.status}</span>
                {" · "}
                <span className="tabular-nums">{result.duration_ms} ms</span>
                {" · "}
                <span className="tabular-nums">
                  {result.detections.length} señales
                </span>
              </div>
              {mainSignal && (
                <div className="mt-2 inline-flex items-center gap-2 px-2 py-1 bg-accent/10 border border-accent/30 rounded">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-accent-light">
                    Booking engine
                  </span>
                  <span className="text-sm font-medium text-text">
                    {mainSignal.vendor}
                  </span>
                  <span className="text-xs text-text-dim">
                    {mainSignal.product}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                onClick={() => run(result.url, true)}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-medium rounded border border-accent/40 bg-accent/10 text-accent-light hover:bg-accent/20 disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Guardar en base"}
              </button>
              {savedOk && (
                <span className="text-[11px] text-positive">{savedOk}</span>
              )}
              {result.persist_error && (
                <span className="text-[11px] text-negative">
                  {result.persist_error}
                </span>
              )}
            </div>
          </div>

          {result.detections.length === 0 ? (
            <div className="border border-border rounded-md bg-surface p-6 text-center text-sm text-text-dim">
              No se detectaron señales conocidas. El sitio puede ser SPA sin
              hidratar (Fase 1E agrega fallback con browser headless).
            </div>
          ) : (
            <div className="space-y-3">
              {groupedDetections.map((group) => (
                <div
                  key={group.category}
                  className="border border-border rounded-md bg-surface overflow-hidden"
                >
                  <div className="px-3 py-1.5 bg-surface-2 text-[10px] font-semibold uppercase tracking-wider text-text-dim border-b border-border">
                    {CATEGORY_LABEL[group.category] || group.category}
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {group.items.map((d) => (
                        <tr
                          key={d.rule_id}
                          className="border-b border-border last:border-0"
                        >
                          <td className="px-3 py-2 min-w-[160px]">
                            <div className="font-medium text-text">
                              {d.vendor}
                            </div>
                            <div className="text-[11px] text-text-dim">
                              {d.product}
                            </div>
                          </td>
                          <td className="px-3 py-2 w-36">
                            <ConfidenceBar value={d.confidence} />
                          </td>
                          <td className="px-3 py-2 text-[11px] text-text-dim">
                            {d.evidence.slice(0, 2).map((e, i) => (
                              <div key={i} className="truncate max-w-[600px]">
                                <span className="text-text-muted">
                                  {e.signature_type}
                                </span>
                                {": "}
                                <span className="font-mono">
                                  {e.matched.length > 100
                                    ? e.matched.slice(0, 100) + "…"
                                    : e.matched}
                                </span>
                              </div>
                            ))}
                            {d.evidence.length > 2 && (
                              <div className="text-text-dim">
                                +{d.evidence.length - 2} señales más
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          <details className="border border-border rounded-md bg-surface">
            <summary className="px-3 py-2 text-xs text-text-muted cursor-pointer select-none">
              Datos técnicos (scripts · iframes · outbound links)
            </summary>
            <div className="px-3 py-2 text-[11px] text-text-dim grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <div className="font-semibold uppercase tracking-wider mb-1">
                  Scripts ({result.script_srcs.length})
                </div>
                <ul className="space-y-0.5">
                  {result.script_srcs.slice(0, 15).map((s, i) => (
                    <li key={i} className="font-mono truncate">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-semibold uppercase tracking-wider mb-1">
                  Iframes ({result.iframe_srcs.length})
                </div>
                <ul className="space-y-0.5">
                  {result.iframe_srcs.slice(0, 15).map((s, i) => (
                    <li key={i} className="font-mono truncate">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-semibold uppercase tracking-wider mb-1">
                  Outbound links ({result.outbound_links.length})
                </div>
                <ul className="space-y-0.5">
                  {result.outbound_links.slice(0, 15).map((s, i) => (
                    <li key={i} className="font-mono truncate">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
