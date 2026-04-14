"use client";

import type { KpiImpact } from "@/lib/pis/types";

const IMPACT_STYLES = {
  high: "bg-negative-muted text-negative",
  medium: "bg-neutral-muted text-neutral-sent",
  low: "bg-positive-muted text-positive",
};

export function KpiImpactTable({ impacts }: { impacts: KpiImpact[] }) {
  if (!impacts || impacts.length === 0) {
    return <p className="text-sm text-text-dim">No KPI impacts identified.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-2">
            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-dim">
              KPI
            </th>
            <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-text-dim">
              Impacto
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-dim">
              Explicación
            </th>
          </tr>
        </thead>
        <tbody>
          {impacts.map((impact, i) => (
            <tr
              key={impact.kpi_id}
              className={i % 2 === 0 ? "bg-surface" : "bg-surface-2/50"}
            >
              <td className="px-3 py-2 font-medium text-text">
                {impact.kpi_name}
              </td>
              <td className="px-3 py-2 text-center">
                <span
                  className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${IMPACT_STYLES[impact.impact]}`}
                >
                  {impact.impact}
                </span>
              </td>
              <td className="px-3 py-2 text-text-muted">
                {impact.explanation}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
