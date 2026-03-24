"use client";

interface BarItem {
  label: string;
  value: number; // 0-1
  count?: number;
  sublabel?: string;
}

interface BarChartProps {
  items: BarItem[];
  color?: string;
  maxItems?: number;
}

export function BarChart({
  items,
  color = "var(--color-accent)",
  maxItems = 10,
}: BarChartProps) {
  const displayed = items.slice(0, maxItems);
  const maxValue = Math.max(...displayed.map((i) => i.value), 0.01);

  return (
    <div className="space-y-2">
      {displayed.map((item, idx) => (
        <div key={idx} className="flex items-center gap-3">
          <div className="w-36 shrink-0 text-xs text-text-muted truncate" title={item.label}>
            {item.label}
          </div>
          <div className="flex-1 h-5 bg-surface-2 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(item.value / maxValue) * 100}%`,
                backgroundColor: color,
                minWidth: item.value > 0 ? "4px" : "0",
              }}
            />
          </div>
          <div className="w-14 shrink-0 text-right text-xs font-medium text-text">
            {Math.round(item.value * 100)}%
            {item.count !== undefined && (
              <span className="text-text-dim"> ({item.count})</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
