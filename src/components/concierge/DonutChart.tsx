"use client";

interface DonutChartProps {
  value: number; // 0-1
  label: string;
  sublabel?: string;
  size?: number;
  color?: string;
}

export function DonutChart({
  value,
  label,
  sublabel,
  size = 120,
  color = "var(--color-accent)",
}: DonutChartProps) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(1, Math.max(0, value)));
  const pct = Math.round(value * 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface-3)"
          strokeWidth="10"
        />
        {/* Value arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
        />
        {/* Center text */}
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          className="text-text"
          style={{ fontSize: size * 0.22, fontWeight: 700 }}
        >
          {pct}%
        </text>
      </svg>
      <div className="text-center">
        <div className="text-xs font-semibold text-text">{label}</div>
        {sublabel && <div className="text-[10px] text-text-dim">{sublabel}</div>}
      </div>
    </div>
  );
}
