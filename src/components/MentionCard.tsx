"use client";

import { Mention } from "@/lib/types";
import { SentimentBadge } from "./SentimentBadge";
import { ConfidenceRing } from "./ConfidenceRing";

interface MentionCardProps {
  mention: Mention;
  index: number;
}

const tierColors = {
  subtopic: "border-l-accent",
  topic: "border-l-neutral-sent",
  area: "border-l-text-dim",
};

const polarityBorder = {
  positive: "border-l-positive",
  negative: "border-l-negative",
  neutral: "border-l-neutral-sent",
};

export function MentionCard({ mention, index }: MentionCardProps) {
  return (
    <div
      className={`animate-fade-in bg-surface rounded-lg border border-border p-4 border-l-[3px] ${polarityBorder[mention.polarity]}`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-sm text-text leading-relaxed italic flex-1">
          &ldquo;{mention.original_text}&rdquo;
        </p>
        <ConfidenceRing value={mention.confidence} />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {mention.subtopic && (
          <span className="px-2 py-0.5 bg-accent/15 text-accent-light text-xs font-mono rounded">
            {mention.subtopic}
          </span>
        )}
        {!mention.subtopic && mention.proposed_subtopic && (
          <span className="px-2 py-0.5 bg-labs-yellow/15 text-labs-yellow text-xs font-mono rounded">
            ? {mention.proposed_subtopic}
          </span>
        )}
        <span className="px-2 py-0.5 bg-surface-3 text-text-muted text-xs rounded">
          {mention.area}
        </span>
        {mention.dimension && (
          <span className="px-2 py-0.5 bg-surface-3 text-text-muted text-xs rounded">
            {mention.dimension}
          </span>
        )}
        <span className={`px-1.5 py-0.5 text-[10px] uppercase tracking-wide rounded ${
          mention.extraction_tier === "subtopic"
            ? "bg-accent/10 text-accent-light"
            : mention.extraction_tier === "topic"
              ? "bg-neutral-muted/40 text-neutral-sent"
              : "bg-surface-3 text-text-dim"
        }`}>
          {mention.extraction_tier}
        </span>
      </div>

      <SentimentBadge polarity={mention.polarity} intensity={mention.intensity} />
    </div>
  );
}
