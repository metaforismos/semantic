"use client";

import { useState, useMemo } from "react";
import { Subtopic, AREAS, DIMENSIONS } from "@/lib/types";
import poolData from "@/data/subtopics_pool.json";

const pool = poolData as Subtopic[];

export default function ExplorerPage() {
  const [filterArea, setFilterArea] = useState<string>("all");
  const [filterDimension, setFilterDimension] = useState<string>("all");
  const [filterPolarity, setFilterPolarity] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"table" | "matrix">("matrix");

  const filtered = useMemo(() => {
    return pool.filter((s) => {
      if (filterArea !== "all" && s.area !== filterArea) return false;
      if (filterDimension !== "all" && s.dimension !== filterDimension) return false;
      if (filterPolarity !== "all" && s.default_polarity !== filterPolarity) return false;
      if (search && !s.subtopic.includes(search.toLowerCase())) return false;
      return true;
    });
  }, [filterArea, filterDimension, filterPolarity, search]);

  // Matrix data
  const matrix = useMemo(() => {
    const m: Record<string, Record<string, Subtopic[]>> = {};
    for (const area of AREAS) {
      m[area] = {};
      for (const dim of DIMENSIONS) {
        m[area][dim] = [];
      }
    }
    for (const s of pool) {
      if (m[s.area] && m[s.area][s.dimension]) {
        m[s.area][s.dimension].push(s);
      }
    }
    return m;
  }, []);

  const maxCount = useMemo(() => {
    let max = 0;
    for (const area of AREAS) {
      for (const dim of DIMENSIONS) {
        max = Math.max(max, matrix[area][dim].length);
      }
    }
    return max;
  }, [matrix]);

  const [selectedCell, setSelectedCell] = useState<{ area: string; dimension: string } | null>(null);

  return (
    <div className="pt-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Pool Explorer</h1>
          <p className="text-sm text-text-muted">
            {pool.length} subtopics across {AREAS.length} areas and {DIMENSIONS.length} dimensions
          </p>
        </div>
        <div className="flex items-center gap-1 bg-surface-2 rounded-lg p-0.5 border border-border">
          <button
            onClick={() => setView("matrix")}
            className={`px-3 py-1 text-xs font-medium rounded ${view === "matrix" ? "bg-accent/15 text-accent-light" : "text-text-muted"}`}
          >
            Matrix
          </button>
          <button
            onClick={() => setView("table")}
            className={`px-3 py-1 text-xs font-medium rounded ${view === "table" ? "bg-accent/15 text-accent-light" : "text-text-muted"}`}
          >
            Table
          </button>
        </div>
      </div>

      {view === "matrix" ? (
        <>
          {/* Heatmap */}
          <div className="bg-surface rounded-lg border border-border p-4 mb-6 overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr>
                  <th className="text-left p-1 text-text-dim font-normal sticky left-0 bg-surface z-10 min-w-[120px]">Area \ Dimension</th>
                  {DIMENSIONS.map((dim) => (
                    <th key={dim} className="p-1 text-text-dim font-normal text-center min-w-[50px]">
                      <span className="block -rotate-45 origin-center whitespace-nowrap">{dim}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {AREAS.map((area) => (
                  <tr key={area} className="hover:bg-surface-2/50">
                    <td className="p-1 text-text-muted text-[11px] font-medium sticky left-0 bg-surface z-10">{area}</td>
                    {DIMENSIONS.map((dim) => {
                      const count = matrix[area][dim].length;
                      const opacity = maxCount > 0 ? count / maxCount : 0;
                      const isSelected = selectedCell?.area === area && selectedCell?.dimension === dim;
                      return (
                        <td key={dim} className="p-0.5 text-center">
                          <button
                            onClick={() => count > 0 && setSelectedCell(isSelected ? null : { area, dimension: dim })}
                            className={`w-full aspect-square rounded-sm flex items-center justify-center transition-all ${
                              count === 0
                                ? "bg-surface-2 cursor-default"
                                : isSelected
                                  ? "ring-2 ring-accent ring-offset-1 ring-offset-surface"
                                  : "hover:ring-1 hover:ring-border-light cursor-pointer"
                            }`}
                            style={{
                              backgroundColor: count > 0 ? `rgba(99, 102, 241, ${0.1 + opacity * 0.7})` : undefined,
                            }}
                          >
                            {count > 0 && (
                              <span className={`text-[9px] font-bold ${opacity > 0.5 ? "text-white" : "text-accent-light"}`}>
                                {count}
                              </span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Selected cell detail */}
          {selectedCell && (
            <div className="animate-fade-in bg-surface rounded-lg border border-border p-4 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold">{selectedCell.area}</span>
                <span className="text-text-dim">&times;</span>
                <span className="text-sm font-semibold">{selectedCell.dimension}</span>
                <span className="text-xs text-text-dim ml-1">
                  ({matrix[selectedCell.area][selectedCell.dimension].length} subtopics)
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {matrix[selectedCell.area][selectedCell.dimension].map((s) => (
                  <span
                    key={s.subtopic}
                    className={`px-2 py-0.5 text-xs font-mono rounded ${
                      s.default_polarity === "positive"
                        ? "bg-positive-muted/30 text-positive"
                        : s.default_polarity === "negative"
                          ? "bg-negative-muted/30 text-negative"
                          : "bg-surface-3 text-text-muted"
                    }`}
                  >
                    {s.subtopic}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <input
              type="text"
              placeholder="Search subtopics..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-1.5 bg-surface-2 border border-border rounded-md text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent/50 w-52"
            />
            <select
              value={filterArea}
              onChange={(e) => setFilterArea(e.target.value)}
              className="px-3 py-1.5 bg-surface-2 border border-border rounded-md text-sm text-text-muted"
            >
              <option value="all">All Areas</option>
              {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select
              value={filterDimension}
              onChange={(e) => setFilterDimension(e.target.value)}
              className="px-3 py-1.5 bg-surface-2 border border-border rounded-md text-sm text-text-muted"
            >
              <option value="all">All Dimensions</option>
              {DIMENSIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select
              value={filterPolarity}
              onChange={(e) => setFilterPolarity(e.target.value)}
              className="px-3 py-1.5 bg-surface-2 border border-border rounded-md text-sm text-text-muted"
            >
              <option value="all">All Polarities</option>
              <option value="positive">Positive</option>
              <option value="negative">Negative</option>
              <option value="context-dependent">Context-dependent</option>
            </select>
            <span className="text-xs text-text-dim self-center ml-auto tabular-nums">{filtered.length} subtopics</span>
          </div>

          {/* Table */}
          <div className="bg-surface rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-2 z-10">
                  <tr className="text-left text-text-dim text-[11px] uppercase tracking-wider">
                    <th className="p-3 font-medium">Subtopic</th>
                    <th className="p-3 font-medium">Area</th>
                    <th className="p-3 font-medium">Dimension</th>
                    <th className="p-3 font-medium">Polarity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((s) => (
                    <tr key={s.subtopic} className="hover:bg-surface-2/50 transition-colors">
                      <td className="p-3 font-mono text-accent-light text-xs">{s.subtopic}</td>
                      <td className="p-3 text-text-muted text-xs">{s.area}</td>
                      <td className="p-3 text-text-muted text-xs">{s.dimension}</td>
                      <td className="p-3">
                        <span className={`text-xs ${
                          s.default_polarity === "positive" ? "text-positive"
                            : s.default_polarity === "negative" ? "text-negative"
                              : "text-text-muted"
                        }`}>
                          {s.default_polarity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
