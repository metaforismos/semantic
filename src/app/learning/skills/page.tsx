"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import type { TeamMember, LeaderboardEntry, CategoryStat } from "@/lib/learning/types";
import { SEGMENT_COLORS } from "@/lib/learning/types";
import { SkillRadar } from "@/components/learning/SkillRadar";
import teamData from "../../../../data/learning_team.json";

const team = teamData as TeamMember[];

const MEDALS = ["🥇", "🥈", "🥉"];

interface PlayerProfile {
  player: LeaderboardEntry;
  category_stats: CategoryStat[];
}

export default function SkillsPage() {
  const [selected, setSelected] = useState<TeamMember | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [scores, setScores] = useState<LeaderboardEntry[]>([]);

  // Fetch leaderboard scores on mount
  useEffect(() => {
    fetch("/api/learning/scores")
      .then((r) => r.json())
      .then((data) => {
        if (data.scores) setScores(data.scores);
      })
      .catch(() => {});
  }, []);

  // Build sorted list: members with scores first (desc), then the rest alphabetically
  const sortedMembers = useMemo(() => {
    const scoreMap = new Map<string, LeaderboardEntry>();
    for (const s of scores) scoreMap.set(s.player_name, s);

    const withScore: { member: TeamMember; score: LeaderboardEntry }[] = [];
    const withoutScore: TeamMember[] = [];

    for (const m of team) {
      const s = scoreMap.get(m.name);
      if (s && Number(s.total_score) > 0) {
        withScore.push({ member: m, score: s });
      } else {
        withoutScore.push(m);
      }
    }

    withScore.sort((a, b) => {
      const pctA = a.score.total_answers > 0 ? a.score.correct_answers / a.score.total_answers : 0;
      const pctB = b.score.total_answers > 0 ? b.score.correct_answers / b.score.total_answers : 0;
      return pctB - pctA || Number(b.score.total_score) - Number(a.score.total_score);
    });
    withoutScore.sort((a, b) => a.name.localeCompare(b.name));

    return { withScore, withoutScore };
  }, [scores]);

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

  const getColor = (member: TeamMember) =>
    SEGMENT_COLORS[team.indexOf(member) % SEGMENT_COLORS.length];

  return (
    <div className="py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text">Skills</h1>
        <p className="text-sm text-text-dim mt-0.5">
          Mapa de conocimiento del equipo — {team.length} colaboradores
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Leaderboard list — left */}
        <div className="w-full lg:w-80 shrink-0">
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
              {/* Members with scores */}
              {sortedMembers.withScore.map(({ member, score }, i) => {
                const isSelected = selected?.name === member.name;
                return (
                  <button
                    key={member.name}
                    onClick={() => handleSelect(member)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border/50 ${
                      isSelected
                        ? "bg-accent/5 border-l-[3px] border-l-accent"
                        : "hover:bg-surface-2"
                    }`}
                  >
                    <div className="w-6 text-center shrink-0">
                      {i < 3 ? (
                        <span className="text-sm">{MEDALS[i]}</span>
                      ) : (
                        <span className="text-xs text-text-dim">{i + 1}</span>
                      )}
                    </div>
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                      style={{ backgroundColor: getColor(member) }}
                    >
                      {member.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-text truncate">
                        {member.name}
                      </div>
                      <div className="text-[11px] text-text-dim truncate">
                        {member.role}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[13px] font-mono font-semibold text-text">
                        {score.total_answers > 0 ? Math.round((score.correct_answers / score.total_answers) * 100) : 0}%
                      </div>
                      <div className="text-[10px] text-text-dim">
                        {score.correct_answers} / {score.total_answers} correctas
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* Separator if both groups exist */}
              {sortedMembers.withScore.length > 0 && sortedMembers.withoutScore.length > 0 && (
                <div className="px-4 py-2 bg-surface-2/50 text-[10px] uppercase tracking-wider text-text-dim font-semibold">
                  Sin puntaje
                </div>
              )}

              {/* Members without scores */}
              {sortedMembers.withoutScore.map((member) => {
                const isSelected = selected?.name === member.name;
                return (
                  <button
                    key={member.name}
                    onClick={() => handleSelect(member)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border/50 last:border-b-0 ${
                      isSelected
                        ? "bg-accent/5 border-l-[3px] border-l-accent"
                        : "hover:bg-surface-2"
                    }`}
                  >
                    <div className="w-6 shrink-0" />
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 opacity-60"
                      style={{ backgroundColor: getColor(member) }}
                    >
                      {member.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-text-muted truncate">
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

          {selected && !loading && (
            <div className="bg-surface border border-border rounded-lg p-6 space-y-5 animate-fade-in">
              {/* Player header */}
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ backgroundColor: getColor(selected) }}
                >
                  {selected.initials}
                </div>
                <div>
                  <div className="text-sm font-semibold text-text">{selected.name}</div>
                  <div className="text-xs text-text-dim">{selected.role}</div>
                </div>
              </div>

              {/* Summary stats — only if has data */}
              {profile && (
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-surface-2 rounded-lg p-3">
                    <div className="text-lg font-bold text-text font-mono">
                      {Number(profile.player.total_score).toLocaleString("es-CL")}
                    </div>
                    <div className="text-[10px] text-text-dim uppercase tracking-wider">Puntaje</div>
                  </div>
                  <div className="bg-surface-2 rounded-lg p-3">
                    <div className="text-lg font-bold text-text">{profile.player.games_played}</div>
                    <div className="text-[10px] text-text-dim uppercase tracking-wider">Respuestas</div>
                  </div>
                  <div className="bg-surface-2 rounded-lg p-3">
                    <div className="text-lg font-bold text-text">{profile.player.highest_question}/15</div>
                    <div className="text-[10px] text-text-dim uppercase tracking-wider">Max nivel</div>
                  </div>
                </div>
              )}

              {/* No data notice */}
              {notFound && (
                <div className="text-center py-2">
                  <p className="text-xs text-text-dim">
                    Sin respuestas registradas — juega Entrenamiento para generar datos
                  </p>
                </div>
              )}

              {/* Radar chart — always shown */}
              <SkillRadar
                categoryStats={profile?.category_stats ?? []}
                playerName={selected.name}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
