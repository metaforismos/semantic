"use client";

import { useState } from "react";

type ResultType = "business" | "page" | "invalid";
type Status = "idle" | "loading" | "success" | "warning" | "error" | "network_error";

interface BusinessDetails {
  id: string;
  name?: string;
  link?: string;
  created_time?: string;
}

interface VerificationResult {
  valid: boolean;
  type: ResultType;
  name?: string;
  category?: string;
  error?: string;
  details?: BusinessDetails;
}

export default function MetaIdPage() {
  const [inputId, setInputId] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<VerificationResult | null>(null);

  async function handleVerify() {
    const id = inputId.trim();
    if (!id) return;

    setStatus("loading");
    setResult(null);

    try {
      const res = await fetch("/api/labs/meta/verify-business-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const data: VerificationResult = await res.json();

      if (data.error === "token_not_configured" || data.error === "network_error" || data.error === "rate_limit") {
        setStatus("network_error");
        setResult(data);
        return;
      }

      if (data.type === "business" && data.valid) {
        setStatus("success");
      } else if (data.type === "page") {
        setStatus("warning");
      } else {
        setStatus("error");
      }
      setResult(data);
    } catch {
      setStatus("network_error");
      setResult(null);
    }
  }

  function handleInputChange(value: string) {
    setInputId(value.replace(/\D/g, ""));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && inputId.trim()) {
      handleVerify();
    }
  }

  const details = result?.details;

  return (
    <div className="pt-14 lg:pt-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-dim">
            Concierge
          </span>
          <span className="text-text-dim">/</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-dim">
            Meta ID
          </span>
        </div>
        <h1 className="text-xl font-bold text-text tracking-tight">
          Verificador de Meta Business ID
        </h1>
        <p className="text-sm text-text-muted mt-1 max-w-xl">
          Pega el Meta Business ID del hotel antes de iniciar el onboarding.
          No uses el ID de la pagina de Facebook.
        </p>
      </div>

      {/* Verifier card */}
      <div className="bg-surface border border-border rounded-lg p-6 max-w-xl">
        {/* Input + Button */}
        <div className="flex gap-3">
          <input
            type="text"
            inputMode="numeric"
            value={inputId}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ej: 123456789012345"
            className="flex-1 px-3 py-2.5 bg-surface-2 border border-border rounded-md text-sm font-mono text-text placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
          />
          <button
            onClick={handleVerify}
            disabled={!inputId.trim() || status === "loading"}
            className="px-5 py-2.5 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {status === "loading" ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Verificando...
              </span>
            ) : (
              "Verificar"
            )}
          </button>
        </div>

        {/* Result area */}
        {status !== "idle" && status !== "loading" && (
          <div className={`mt-4 animate-fade-in rounded-md px-4 py-3 text-sm ${resultStyles[status]}`}>
            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none mt-0.5">{resultIcon[status]}</span>
              <div>
                <ResultMessage status={status} result={result} />
              </div>
            </div>
          </div>
        )}

        {/* Business details */}
        {status === "success" && details && (details.link || details.created_time) && (
          <div className="mt-3 animate-fade-in bg-surface-2 rounded-md p-3">
            <div className="grid grid-cols-2 gap-3">
              {details.link && (
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-text-dim">Link</div>
                  <a href={details.link} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline truncate block">
                    {details.link}
                  </a>
                </div>
              )}
              {details.created_time && (
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-text-dim">Creado</div>
                  <div className="text-xs text-text">{new Date(details.created_time).toLocaleDateString("es-CL")}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Help link */}
        <div className="mt-5 pt-4 border-t border-border">
          <a
            href="https://business.facebook.com/settings"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent hover:text-accent-light transition-colors inline-flex items-center gap-1"
          >
            Donde encuentro el Meta Business ID?
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-60">
              <path d="M4.5 1.5h6v6" /><path d="M10.5 1.5L4 8" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}

const resultStyles: Record<string, string> = {
  success: "bg-positive-muted border border-positive/20 text-positive",
  warning: "bg-neutral-muted border border-neutral-sent/20 text-neutral-sent",
  error: "bg-negative-muted border border-negative/20 text-negative",
  network_error: "bg-surface-2 border border-border text-text-muted",
};

const resultIcon: Record<string, string> = {
  success: "\u2705",
  warning: "\u26A0\uFE0F",
  error: "\u274C",
  network_error: "\uD83D\uDD0C",
};

function ResultMessage({ status, result }: { status: Status; result: VerificationResult | null }) {
  if (status === "success" && result) {
    return (
      <p>
        <span className="font-semibold">Business ID valido</span>
        {result.name && <span> &mdash; {result.name}</span>}
      </p>
    );
  }

  if (status === "warning" && result) {
    return (
      <div>
        <p className="font-semibold">
          Este es un Facebook Page ID{result.name ? ` (${result.name})` : ""}, no un Meta Business ID.
        </p>
        <p className="mt-1 opacity-80">
          Ve a{" "}
          <a href="https://business.facebook.com/settings" target="_blank" rel="noopener noreferrer" className="underline">
            business.facebook.com
          </a>{" "}
          para obtener el correcto.
        </p>
      </div>
    );
  }

  if (status === "error") {
    return <p>ID no encontrado. Verifica que copiaste el numero correcto.</p>;
  }

  if (status === "network_error") {
    if (result?.error === "rate_limit") return <p>Demasiadas solicitudes. Intenta en un minuto.</p>;
    if (result?.error === "token_not_configured") return <p>Token de Meta no configurado. Contacta al equipo de desarrollo.</p>;
    return <p>Error al conectar con Meta. Intenta nuevamente.</p>;
  }

  return null;
}
