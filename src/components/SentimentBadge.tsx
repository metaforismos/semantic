"use client";

interface SentimentBadgeProps {
  polarity: "positive" | "negative" | "neutral";
  intensity: "mild" | "moderate" | "strong";
}

const polarityConfig = {
  positive: { bg: "bg-positive-muted/60", text: "text-positive", label: "+" },
  negative: { bg: "bg-negative-muted/60", text: "text-negative", label: "−" },
  neutral: { bg: "bg-neutral-muted/60", text: "text-neutral-sent", label: "~" },
};

export function SentimentBadge({ polarity, intensity }: SentimentBadgeProps) {
  const config = polarityConfig[polarity];
  const bars = intensity === "strong" ? 3 : intensity === "moderate" ? 2 : 1;

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${config.bg} ${config.text}`}>
        <span className="text-sm leading-none">{config.label}</span>
        {polarity}
      </span>
      <div className="flex items-end gap-[2px] h-3.5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-[3px] rounded-full transition-all ${
              i <= bars ? config.text.replace("text-", "bg-") : "bg-border"
            }`}
            style={{ height: `${6 + i * 3}px` }}
          />
        ))}
      </div>
      <span className="text-[10px] text-text-dim uppercase tracking-wide">{intensity}</span>
    </div>
  );
}
