"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { InitiativeForm } from "@/components/pis/InitiativeForm";
import type { PisInitiative } from "@/lib/pis/types";
import Link from "next/link";

export default function EditInitiativePage() {
  const params = useParams();
  const [initiative, setInitiative] = useState<PisInitiative | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch_() {
      try {
        const res = await fetch(`/api/pis/initiatives/${params.id}`);
        if (!res.ok) throw new Error("not found");
        const data = await res.json();
        setInitiative(data.initiative);
      } catch {
        setInitiative(null);
      } finally {
        setLoading(false);
      }
    }
    fetch_();
  }, [params.id]);

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="skeleton h-8 w-48 rounded mb-6" />
        <div className="skeleton h-96 rounded-lg" />
      </div>
    );
  }

  if (!initiative) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-8 text-center">
        <p className="text-text-dim">Iniciativa no encontrada.</p>
        <Link href="/pis" className="text-accent text-sm hover:underline mt-2 inline-block">
          Volver
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-text">Editar Iniciativa</h1>
        <p className="text-xs text-text-dim mt-1">
          Al editar se reiniciará la evaluación
        </p>
      </div>
      <InitiativeForm initiative={initiative} />
    </div>
  );
}
