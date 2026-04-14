"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ScoreBadge } from "./ScoreBadge";
import { ProductTags } from "./ProductTags";
import { effortPercent } from "@/lib/pis/types";
import type { PisInitiativeSummary } from "@/lib/pis/types";

type StatusFilter = "active" | "scored" | "draft" | "archived";

export function InitiativeList() {
  const [initiatives, setInitiatives] = useState<PisInitiativeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("active");

  useEffect(() => {
    fetchInitiatives();
  }, [filter]);

  async function fetchInitiatives() {
    setLoading(true);
    try {
      const status = filter === "active" ? "" : `?status=${filter}`;
      const res = await fetch(`/api/pis/initiatives${status}`);
      const data = await res.json();
      setInitiatives(data.initiatives || []);
    } catch {
      setInitiatives([]);
    } finally {
      setLoading(false);
    }
  }

  const filters: { key: StatusFilter; label: string }[] = [
    { key: "active", label: "Activas" },
    { key: "scored", label: "Evaluadas" },
    { key: "draft", label: "Borradores" },
    { key: "archived", label: "Archivadas" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === f.key
                  ? "bg-accent/15 text-accent-light"
                  : "text-text-dim hover:text-text-muted hover:bg-surface-2"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Link
          href="/pis/new"
          className="px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-md hover:bg-accent-light transition-colors"
        >
          + Nueva iniciativa
        </Link>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-14 rounded-lg" />
          ))}
        </div>
      ) : initiatives.length === 0 ? (
        <div className="text-center py-12 text-text-dim text-sm">
          No hay iniciativas{filter !== "active" ? ` con estado "${filter}"` : ""}.{" "}
          <Link href="/pis/new" className="text-accent hover:underline">
            Crear una
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-2">
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-text-dim w-20">
                  PIS
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-text-dim">
                  Iniciativa
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-text-dim">
                  Productos
                </th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-text-dim w-20">
                  Hipótesis
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-text-dim w-24">
                  Célula
                </th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-text-dim w-20">
                  Jornadas
                </th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-text-dim w-20">
                  % Ciclo
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-text-dim w-24">
                  Autor
                </th>
              </tr>
            </thead>
            <tbody>
              {initiatives.map((init, i) => (
                <tr
                  key={init.id}
                  className={`${i % 2 === 0 ? "bg-surface" : "bg-surface-2/50"} hover:bg-accent/5 transition-colors cursor-pointer`}
                >
                  <td className="px-3 py-2.5">
                    <Link href={`/pis/${init.id}`}>
                      <ScoreBadge score={init.pis_score} size="sm" />
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/pis/${init.id}`}
                      className="font-medium text-text hover:text-accent-light transition-colors"
                    >
                      {init.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <ProductTags products={init.products} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <ScoreBadge score={init.hypothesis_score} size="sm" />
                  </td>
                  <td className="px-3 py-2.5 text-text-muted text-xs">
                    {init.celula || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-center text-text-muted text-xs">
                    {init.jornadas != null ? init.jornadas : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs">
                    {effortPercent(init.jornadas) != null ? (
                      <span className={`font-semibold ${
                        effortPercent(init.jornadas)! > 50
                          ? "text-negative"
                          : effortPercent(init.jornadas)! > 25
                            ? "text-neutral-sent"
                            : "text-positive"
                      }`}>
                        {effortPercent(init.jornadas)}%
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-text-muted text-xs">
                    {init.author || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
