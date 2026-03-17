"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePrompts } from "@/components/PromptContext";
import { DEFAULT_EXTRACTION_INSTRUCTIONS, DEFAULT_VALIDATION_INSTRUCTIONS } from "@/lib/prompts";

type Tab = "extraction" | "validation";

export default function PromptsPage() {
  const router = useRouter();
  const {
    extractionInstructions,
    validationInstructions,
    setExtractionInstructions,
    setValidationInstructions,
    resetExtraction,
    resetValidation,
    isExtractionCustom,
    isValidationCustom,
  } = usePrompts();

  const [tab, setTab] = useState<Tab>("extraction");

  const current = tab === "extraction" ? extractionInstructions : validationInstructions;
  const setCurrent = tab === "extraction" ? setExtractionInstructions : setValidationInstructions;
  const resetCurrent = tab === "extraction" ? resetExtraction : resetValidation;
  const isCustom = tab === "extraction" ? isExtractionCustom : isValidationCustom;
  const defaultText = tab === "extraction" ? DEFAULT_EXTRACTION_INSTRUCTIONS : DEFAULT_VALIDATION_INSTRUCTIONS;

  const tokenEstimate = Math.round(current.length / 4);

  const handleSaveAndTest = () => {
    router.push("/");
  };

  return (
    <div className="pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Prompt Editor</h1>
        <p className="text-sm text-text-muted">
          Edit the instruction templates used by the extraction and validation engines.
          The subtopic pool is injected automatically — you only edit the rules and output format.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4">
        <button
          onClick={() => setTab("extraction")}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            tab === "extraction"
              ? "bg-accent/15 text-accent-light"
              : "text-text-muted hover:text-text hover:bg-surface-2"
          }`}
        >
          Extraction Prompt
          {isExtractionCustom && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-labs-yellow inline-block" />}
        </button>
        <button
          onClick={() => setTab("validation")}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            tab === "validation"
              ? "bg-accent/15 text-accent-light"
              : "text-text-muted hover:text-text hover:bg-surface-2"
          }`}
        >
          Validation Prompt
          {isValidationCustom && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-labs-yellow inline-block" />}
        </button>
      </div>

      {/* Info bar */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3 text-xs text-text-dim">
          <span className="tabular-nums">~{tokenEstimate.toLocaleString()} tokens</span>
          <span className="tabular-nums">{current.length.toLocaleString()} chars</span>
          {isCustom && (
            <span className="text-labs-yellow flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-labs-yellow" />
              Modified
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetCurrent}
            disabled={!isCustom}
            className="px-2.5 py-1 text-xs text-text-muted hover:text-text bg-surface-2 hover:bg-surface-3 border border-border rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Reset to Default
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="relative">
        <div className="absolute top-2 left-3 text-[10px] text-text-dim/50 font-mono pointer-events-none select-none">
          {tab === "extraction" ? "// Extraction instructions" : "// Validation instructions"}
          {" — pool data injected above automatically"}
        </div>
        <textarea
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          spellCheck={false}
          className="w-full min-h-[500px] bg-surface border border-border rounded-lg p-4 pt-8 font-mono text-[13px] leading-relaxed text-text placeholder:text-text-dim resize-y focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-colors"
        />
      </div>

      {/* Diff indicator */}
      {isCustom && (
        <div className="mt-3 bg-surface rounded-lg border border-border p-3">
          <div className="text-[11px] uppercase tracking-wider text-text-dim mb-2">Changes from default</div>
          <div className="flex items-center gap-3 text-xs text-text-muted">
            <span>Default: {defaultText.length.toLocaleString()} chars</span>
            <span>Current: {current.length.toLocaleString()} chars</span>
            <span className={current.length > defaultText.length ? "text-positive" : current.length < defaultText.length ? "text-negative" : "text-text-dim"}>
              {current.length > defaultText.length ? "+" : ""}{current.length - defaultText.length} chars
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSaveAndTest}
          className="px-4 py-2 bg-accent hover:bg-accent-light text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Save & Go to Analysis
        </button>
        <span className="text-xs text-text-dim">
          Prompts are saved in your browser session and applied to all subsequent analysis runs.
        </span>
      </div>
    </div>
  );
}
