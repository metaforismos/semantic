"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import type { TeamMember } from "@/lib/learning/types";
import { SEGMENT_COLORS } from "@/lib/learning/types";

interface Props {
  members: TeamMember[];
  onSelect: (member: TeamMember) => void;
  disabled?: boolean;
}

export function RouletteWheel({ members, onSelect, disabled }: Props) {
  const groupRef = useRef<SVGGElement>(null);
  const [spinning, setSpinning] = useState(false);
  const targetIndexRef = useRef<number | null>(null);

  const count = members.length;
  const anglePerSegment = 360 / count;
  const cx = 200;
  const cy = 200;
  const r = 180;

  const spin = useCallback(() => {
    if (spinning || disabled) return;

    const targetIndex = Math.floor(Math.random() * count);
    targetIndexRef.current = targetIndex;

    // Pointer is at top (270°). We need the target segment's midpoint at the top.
    // Segment i spans from i*anglePerSegment to (i+1)*anglePerSegment
    const segmentMid = targetIndex * anglePerSegment + anglePerSegment / 2;
    // Rotation needed so segmentMid aligns with 270° (top)
    const baseRotation = 270 - segmentMid;
    // Add full rotations for dramatic effect
    const fullSpins = 5 + Math.floor(Math.random() * 3);
    const totalRotation = baseRotation + fullSpins * 360;

    const el = groupRef.current;
    if (!el) return;

    setSpinning(true);
    el.style.transition = "none";
    el.style.transform = "rotate(0deg)";

    // Force reflow
    void el.getBoundingClientRect();

    el.style.transition = "transform 4s cubic-bezier(0.2, 0.8, 0.3, 1)";
    el.style.transform = `rotate(${totalRotation}deg)`;
  }, [spinning, disabled, count, anglePerSegment]);

  useEffect(() => {
    const el = groupRef.current;
    if (!el) return;

    const handleEnd = () => {
      setSpinning(false);
      if (targetIndexRef.current !== null) {
        onSelect(members[targetIndexRef.current]);
        targetIndexRef.current = null;
      }
    };

    el.addEventListener("transitionend", handleEnd);
    return () => el.removeEventListener("transitionend", handleEnd);
  }, [members, onSelect]);

  // Build segments
  const segments = members.map((member, i) => {
    const startAngle = (i * anglePerSegment * Math.PI) / 180;
    const endAngle = ((i + 1) * anglePerSegment * Math.PI) / 180;
    const x1 = Math.round((cx + r * Math.cos(startAngle)) * 100) / 100;
    const y1 = Math.round((cy + r * Math.sin(startAngle)) * 100) / 100;
    const x2 = Math.round((cx + r * Math.cos(endAngle)) * 100) / 100;
    const y2 = Math.round((cy + r * Math.sin(endAngle)) * 100) / 100;
    const largeArc = anglePerSegment > 180 ? 1 : 0;

    const midAngle = (startAngle + endAngle) / 2;
    const textR = r * 0.7;
    const tx = Math.round((cx + textR * Math.cos(midAngle)) * 100) / 100;
    const ty = Math.round((cy + textR * Math.sin(midAngle)) * 100) / 100;
    const textRotation = Math.round(((midAngle * 180) / Math.PI) * 100) / 100;

    const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];

    return (
      <g key={member.initials + i}>
        <path
          d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
          fill={color}
          stroke="#1a1a2e"
          strokeWidth="1"
        />
        <text
          x={String(tx)}
          y={String(ty)}
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          fontSize={count > 20 ? "8" : "10"}
          fontWeight="600"
          transform={`rotate(${textRotation}, ${tx}, ${ty})`}
        >
          {member.initials}
        </text>
      </g>
    );
  });

  return (
    <div className="relative flex flex-col items-center">
      {/* Pointer triangle at top */}
      <div className="relative z-10 -mb-3">
        <svg width="24" height="20" viewBox="0 0 24 20">
          <polygon points="12,20 0,0 24,0" fill="#1a1a2e" />
        </svg>
      </div>

      <svg viewBox="0 0 400 400" className="w-full max-w-[400px]">
        {/* Outer ring */}
        <circle cx={cx} cy={cy} r={r + 5} fill="none" stroke="#1a1a2e" strokeWidth="4" />

        {/* Rotating group */}
        <g ref={groupRef} style={{ transformOrigin: `${cx}px ${cy}px` }}>
          {segments}
        </g>

        {/* Center circle */}
        <circle cx={cx} cy={cy} r={30} fill="#1a1a2e" />
        <circle cx={cx} cy={cy} r={28} fill="var(--color-surface)" />
      </svg>

      <button
        onClick={spin}
        disabled={spinning || disabled}
        className="mt-4 px-8 py-3 bg-accent text-white font-bold text-lg rounded-xl hover:bg-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {spinning ? "Girando..." : "Girar la Ruleta"}
      </button>
    </div>
  );
}
