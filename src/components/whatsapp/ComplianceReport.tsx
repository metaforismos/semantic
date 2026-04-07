"use client";

import type { ComplianceResult } from "@/lib/whatsapp/types";

interface Props {
  result: ComplianceResult;
}

export default function ComplianceReport({ result }: Props) {
  const { passed, violations, score } = result;

  return (
    <div className="animate-fade-in">
      {/* Score badge */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wide ${
            passed
              ? "bg-positive/10 text-positive border border-positive/20"
              : "bg-negative/10 text-negative border border-negative/20"
          }`}
        >
          {passed ? "Compliant" : "Non-compliant"}
        </div>
        <div className="text-sm text-text-muted">
          Score: <span className={`font-bold ${passed ? "text-positive" : "text-negative"}`}>{score}/100</span>
        </div>
      </div>

      {/* Violations */}
      {violations.length > 0 && (
        <div className="space-y-2">
          {violations.map((v, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 text-xs px-3 py-2 rounded-md ${
                v.severity === "error"
                  ? "bg-negative/5 border border-negative/15 text-negative"
                  : "bg-neutral-sent/5 border border-neutral-sent/15 text-neutral-sent"
              }`}
            >
              <span className="font-mono text-[10px] mt-0.5 shrink-0 opacity-60">
                {v.severity === "error" ? "ERR" : "WRN"}
              </span>
              <div>
                <span className="font-medium">[{v.location}]</span>{" "}
                {v.message}
              </div>
            </div>
          ))}
        </div>
      )}

      {passed && violations.length === 0 && (
        <p className="text-xs text-text-dim">
          Ningun problema detectado. Template listo para enviar a Meta.
        </p>
      )}
    </div>
  );
}
