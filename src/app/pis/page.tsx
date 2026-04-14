"use client";

import { useState, useCallback } from "react";
import { InitiativeList } from "@/components/pis/InitiativeList";
import { KnowledgeManager } from "@/components/pis/KnowledgeManager";
import { CsvUpload } from "@/components/pis/CsvUpload";

type Tab = "initiatives" | "knowledge";

export default function PisPage() {
  const [tab, setTab] = useState<Tab>("initiatives");
  const [showUpload, setShowUpload] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadComplete = useCallback(() => {
    setRefreshKey((k) => k + 1);
    setShowUpload(false);
  }, []);

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-text">
            Product Intelligence System
          </h1>
          <p className="text-xs text-text-dim mt-1">
            Evalúa y prioriza iniciativas de producto contra los KPIs 2026 de
            myHotel
          </p>
        </div>
        {tab === "initiatives" && (
          <button
            onClick={() => setShowUpload(!showUpload)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              showUpload
                ? "bg-accent/15 border-accent/40 text-accent-light"
                : "bg-surface border-border text-text-muted hover:border-border-light"
            }`}
          >
            {showUpload ? "Cerrar carga CSV" : "Carga masiva CSV"}
          </button>
        )}
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

      {tab === "initiatives" ? (
        <div className="space-y-4">
          {showUpload && <CsvUpload onComplete={handleUploadComplete} />}
          <InitiativeList key={refreshKey} />
        </div>
      ) : (
        <KnowledgeManager />
      )}
    </div>
  );
}
