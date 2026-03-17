"use client";

interface ConfidenceRingProps {
  value: number;
  size?: number;
}

export function ConfidenceRing({ value, size = 36 }: ConfidenceRingProps) {
  const pct = Math.round(value * 100);
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - value);

  const color =
    pct >= 80 ? "stroke-positive" : pct >= 50 ? "stroke-neutral-sent" : "stroke-negative";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={2.5} className="text-border" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={2.5}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={color}
        />
      </svg>
      <span className="absolute text-[9px] font-bold text-text-muted">{pct}</span>
    </div>
  );
}
