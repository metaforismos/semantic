"use client";

import { InitiativeForm } from "@/components/pis/InitiativeForm";

export default function NewInitiativePage() {
  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-text">Nueva Iniciativa</h1>
        <p className="text-xs text-text-dim mt-1">
          Describe la iniciativa y su hipótesis para evaluarla contra los KPIs
          2026
        </p>
      </div>
      <InitiativeForm />
    </div>
  );
}
