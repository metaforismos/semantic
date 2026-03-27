"use client";

import { useMemo } from "react";
import type { CategoryStat } from "@/lib/learning/types";
import { RADAR_CATEGORIES } from "@/lib/learning/types";

interface Props {
  categoryStats: CategoryStat[];
  playerName: string;
}

const SIZE = 300;
const CX = SIZE / 2;
const CY = SIZE / 2;
const RADIUS = 110;
const AXES = RADAR_CATEGORIES.length;
const GUIDE_LEVELS = [0.25, 0.5, 0.75, 1.0];

function polarToCart(angle: number, r: number): [number, number] {
  return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)];
}

function getAngle(i: number): number {
  return (i * 2 * Math.PI) / AXES - Math.PI / 2;
}

function polygonPoints(values: number[]): string {
  return values
    .map((v, i) => {
      const [x, y] = polarToCart(getAngle(i), RADIUS * v);
      return `${x},${y}`;
    })
    .join(" ");
}

export function SkillRadar({ categoryStats, playerName }: Props) {
  const radarData = useMemo(() => {
    return RADAR_CATEGORIES.map((axis) => {
      let correct = 0;
      let total = 0;
      for (const cat of axis.categories) {
        const stat = categoryStats.find((s) => s.category === cat);
        if (stat) {
          correct += stat.correct;
          total += stat.total;
        }
      }
      return {
        label: axis.label,
        correct,
        total,
        pct: total > 0 ? correct / total : 0,
      };
    });
  }, [categoryStats]);

  const hasData = radarData.some((d) => d.total > 0);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-text">
        Mapa de conocimientos — {playerName}
      </h3>

      <div className="flex justify-center">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[300px]">
          {/* Guide polygons */}
          {GUIDE_LEVELS.map((level) => (
            <polygon
              key={level}
              points={polygonPoints(Array(AXES).fill(level))}
              fill="none"
              stroke="var(--color-border)"
              strokeWidth="0.5"
              opacity="0.6"
            />
          ))}

          {/* Axis lines */}
          {Array.from({ length: AXES }, (_, i) => {
            const [x, y] = polarToCart(getAngle(i), RADIUS);
            return (
              <line
                key={i}
                x1={CX}
                y1={CY}
                x2={x}
                y2={y}
                stroke="var(--color-border)"
                strokeWidth="0.5"
                opacity="0.6"
              />
            );
          })}

          {/* Data polygon */}
          {hasData && (
            <polygon
              points={polygonPoints(radarData.map((d) => d.pct))}
              fill="var(--color-accent)"
              fillOpacity="0.2"
              stroke="var(--color-accent)"
              strokeWidth="2"
            />
          )}

          {/* Data points */}
          {hasData &&
            radarData.map((d, i) => {
              const [x, y] = polarToCart(getAngle(i), RADIUS * d.pct);
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={4}
                  fill="var(--color-accent)"
                  stroke="white"
                  strokeWidth="1.5"
                />
              );
            })}

          {/* Labels */}
          {radarData.map((d, i) => {
            const labelR = RADIUS + 18;
            const [x, y] = polarToCart(getAngle(i), labelR);
            return (
              <text
                key={i}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="9"
                fontWeight="600"
                fill="var(--color-text-muted)"
              >
                {d.label}
              </text>
            );
          })}

          {/* Guide level labels */}
          {GUIDE_LEVELS.map((level) => {
            const [, y] = polarToCart(-Math.PI / 2, RADIUS * level);
            return (
              <text
                key={level}
                x={CX + 4}
                y={y - 3}
                fontSize="7"
                fill="var(--color-text-dim)"
              >
                {Math.round(level * 100)}%
              </text>
            );
          })}
        </svg>
      </div>

      {/* Legend table */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs">
        {radarData.map((d) => (
          <div key={d.label} className="flex justify-between">
            <span className="text-text-muted">{d.label}</span>
            <span className="font-mono text-text-dim">
              {d.total > 0 ? `${d.correct}/${d.total} (${Math.round(d.pct * 100)}%)` : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
