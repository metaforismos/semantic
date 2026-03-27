"use client";

import { useState, useCallback } from "react";
import type { TeamMember, LeaderboardEntry, CategoryStat } from "@/lib/learning/types";
import { SEGMENT_COLORS } from "@/lib/learning/types";
import { SkillRadar } from "@/components/learning/SkillRadar";
import teamData from "../../../../data/learning_team.json";

const team = teamData as TeamMember[];

interface PlayerProfile {
  player: LeaderboardEntry;
  category_stats: CategoryStat[];
}

export default function SkillsPage() {
  const [selected, setSelected] = useState<TeamMember | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const handleSelect = useCallback(async (member: TeamMember) => {
    setSelected(member);
    setProfile(null);
    setNotFound(false);
    setLoading(true);

    try {
      const res = await fetch(`/api/learning/scores/${encodeURIComponent(member.name)}`);
      if (res.status === 404) {
        setNotFound(true);
      } else {
        const data = await res.json();
        if (data.player) {
          setProfile({ player: data.player, category_stats: data.category_stats });
        } else {
          setNotFound(true);
        }
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const selectedColor = selected
    ? SEGMENT_COLORS[team.indexOf(selected) % SEGMENT_COLORS.length]
    : undefined;

  return (
    <div className="py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-text">Skills</h1>
        <p className="text-sm text-text-dim mt-0.5">
          Mapa de conocimiento del equipo — {team.length} colaboradores
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* People list — left */}
        <div className="w-full lg:w-80 shrink-0">
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
              {team.map((member, i) => {
                const isSelected = selected?.name === member.name;
                const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];

                return (
                  <button
                    key={member.initials + i}
                    onClick={() => handleSelect(member)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border/50 last:border-b-0 ${
                      isSelected
                        ? "bg-accent/5 border-l-[3px] border-l-accent"
                        : "hover:bg-surface-2"
                    }`}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      {member.initials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-text truncate">
                        {member.name}
                      </div>
                      <div className="text-[11px] text-text-dim truncate">
                        {member.role}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Profile panel — right */}
        <div className="flex-1 min-w-0">
          {!selected && (
            <div className="bg-surface border border-border rounded-lg p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center mx-auto mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-dim">
                  <path d="M12 12c2.5 0 4.5-2 4.5-4.5S14.5 3 12 3 7.5 5 7.5 7.5 9.5 12 12 12z" />
                  <path d="M20 21c0-3.3-3.6-6-8-6s-8 2.7-8 6" />
                </svg>
              </div>
              <p className="text-sm text-text-dim">
                Selecciona un colaborador para ver su perfil de habilidades
              </p>
            </div>
          )}

          {selected && loading && (
            <div className="bg-surface border border-border rounded-lg p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-surface-2 animate-pulse-slow mx-auto mb-3" />
              <p className="text-sm text-text-dim">Cargando perfil...</p>
            </div>
          )}

          {selected && !loading && notFound && (
            <div className="bg-surface border border-border rounded-lg p-6 space-y-4 animate-fade-in">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ backgroundColor: selectedColor }}
                >
                  {selected.initials}
                </div>
                <div>
                  <div className="text-sm font-semibold text-text">{selected.name}</div>
                  <div className="text-xs text-text-dim">{selected.role}</div>
                </div>
              </div>
              <div className="py-8 text-center">
                <div className="text-3xl mb-2">📊</div>
                <p className="text-sm text-text-muted font-medium">Sin datos aún</p>
                <p className="text-xs text-text-dim mt-1">
                  Juega myLearning para registrar habilidades
                </p>
              </div>
            </div>
          )}

          {selected && !loading && profile && (
            <div className="bg-surface border border-border rounded-lg p-6 space-y-5 animate-fade-in">
              {/* Player header */}
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ backgroundColor: selectedColor }}
                >
                  {selected.initials}
                </div>
                <div>
                  <div className="text-sm font-semibold text-text">{selected.name}</div>
                  <div className="text-xs text-text-dim">{selected.role}</div>
                </div>
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-surface-2 rounded-lg p-3">
                  <div className="text-lg font-bold text-text font-mono">
                    {Number(profile.player.total_score).toLocaleString("es-CL")}
                  </div>
                  <div className="text-[10px] text-text-dim uppercase tracking-wider">Puntaje</div>
                </div>
                <div className="bg-surface-2 rounded-lg p-3">
                  <div className="text-lg font-bold text-text">{profile.player.games_played}</div>
                  <div className="text-[10px] text-text-dim uppercase tracking-wider">Juegos</div>
                </div>
                <div className="bg-surface-2 rounded-lg p-3">
                  <div className="text-lg font-bold text-text">{profile.player.highest_question}/15</div>
                  <div className="text-[10px] text-text-dim uppercase tracking-wider">Max nivel</div>
                </div>
              </div>

              {/* Radar chart */}
              <SkillRadar
                categoryStats={profile.category_stats}
                playerName={selected.name}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
