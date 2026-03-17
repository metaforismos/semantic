"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { DEFAULT_EXTRACTION_INSTRUCTIONS, DEFAULT_VALIDATION_INSTRUCTIONS } from "@/lib/prompts";

interface PromptState {
  extractionInstructions: string;
  validationInstructions: string;
  setExtractionInstructions: (v: string) => void;
  setValidationInstructions: (v: string) => void;
  resetExtraction: () => void;
  resetValidation: () => void;
  isExtractionCustom: boolean;
  isValidationCustom: boolean;
}

const PromptContext = createContext<PromptState | null>(null);

const STORAGE_KEY_EXTRACTION = "semantic-prompt-extraction";
const STORAGE_KEY_VALIDATION = "semantic-prompt-validation";

export function PromptProvider({ children }: { children: ReactNode }) {
  const [extractionInstructions, setExtractionRaw] = useState(DEFAULT_EXTRACTION_INSTRUCTIONS);
  const [validationInstructions, setValidationRaw] = useState(DEFAULT_VALIDATION_INSTRUCTIONS);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from sessionStorage on mount
  useEffect(() => {
    try {
      const storedE = sessionStorage.getItem(STORAGE_KEY_EXTRACTION);
      const storedV = sessionStorage.getItem(STORAGE_KEY_VALIDATION);
      if (storedE) setExtractionRaw(storedE);
      if (storedV) setValidationRaw(storedV);
    } catch {}
    setHydrated(true);
  }, []);

  const setExtractionInstructions = (v: string) => {
    setExtractionRaw(v);
    try { sessionStorage.setItem(STORAGE_KEY_EXTRACTION, v); } catch {}
  };

  const setValidationInstructions = (v: string) => {
    setValidationRaw(v);
    try { sessionStorage.setItem(STORAGE_KEY_VALIDATION, v); } catch {}
  };

  const resetExtraction = () => {
    setExtractionRaw(DEFAULT_EXTRACTION_INSTRUCTIONS);
    try { sessionStorage.removeItem(STORAGE_KEY_EXTRACTION); } catch {}
  };

  const resetValidation = () => {
    setValidationRaw(DEFAULT_VALIDATION_INSTRUCTIONS);
    try { sessionStorage.removeItem(STORAGE_KEY_VALIDATION); } catch {}
  };

  return (
    <PromptContext.Provider
      value={{
        extractionInstructions,
        validationInstructions,
        setExtractionInstructions: hydrated ? setExtractionInstructions : () => {},
        setValidationInstructions: hydrated ? setValidationInstructions : () => {},
        resetExtraction: hydrated ? resetExtraction : () => {},
        resetValidation: hydrated ? resetValidation : () => {},
        isExtractionCustom: hydrated && extractionInstructions !== DEFAULT_EXTRACTION_INSTRUCTIONS,
        isValidationCustom: hydrated && validationInstructions !== DEFAULT_VALIDATION_INSTRUCTIONS,
      }}
    >
      {children}
    </PromptContext.Provider>
  );
}

export function usePrompts() {
  const ctx = useContext(PromptContext);
  if (!ctx) throw new Error("usePrompts must be used within PromptProvider");
  return ctx;
}
