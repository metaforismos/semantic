"use client";

import { useState } from "react";
import { InitiativeList } from "@/components/pis/InitiativeList";
import { KnowledgeManager } from "@/components/pis/KnowledgeManager";

type Tab = "initiatives" | "knowledge";

export default function PisPage() {
  const [tab, setTab] = useState<Tab>("initiatives");

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-text">
          Product Intelligence System
        </h1>
        <p className="text-xs text-text-dim mt-1">
          Evalúa y prioriza iniciativas de producto contra los KPIs 2026 de
          myHotel
        </p>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 mb-6 border-b border-border">
        <button
          onClick={() => setTab("initiatives")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "initiatives"
              ? "border-accent text-accent-light"
              : "border-transparent text-text-dim hover:text-text-muted"
          }`}
        >
          Iniciativas
        </button>
        <button
          onClick={() => setTab("knowledge")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "knowledge"
              ? "border-accent text-accent-light"
              : "border-transparent text-text-dim hover:text-text-muted"
          }`}
        >
          Base de Conocimiento
        </button>
      </div>

      {tab === "initiatives" ? <InitiativeList /> : <KnowledgeManager />}
    </div>
  );
}
