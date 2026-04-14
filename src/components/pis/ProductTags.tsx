"use client";

const PRODUCT_COLORS: Record<string, string> = {
  PreStay: "bg-purple-100 text-purple-700",
  OnSite: "bg-blue-100 text-blue-700",
  FollowUp: "bg-cyan-100 text-cyan-700",
  Semantic: "bg-amber-100 text-amber-700",
  Concierge: "bg-green-100 text-green-700",
  Desk: "bg-rose-100 text-rose-700",
  Transversal: "bg-slate-100 text-slate-700",
};

export function ProductTags({ products }: { products: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {products.map((p) => (
        <span
          key={p}
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${PRODUCT_COLORS[p] || "bg-surface-3 text-text-dim"}`}
        >
          {p}
        </span>
      ))}
    </div>
  );
}
