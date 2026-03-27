"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { GameState, GameSession, TeamMember, LeaderboardEntry, CategoryStat } from "@/lib/learning/types";
import type { Question } from "@/lib/learning/types";
import { PRIZE_LADDER } from "@/lib/learning/types";
import dynamic from "next/dynamic";
import { selectQuestions, getCheckpointScore, getCurrentPrize } from "@/lib/learning/game";
import { QuestionDisplay } from "@/components/learning/QuestionDisplay";
import { Leaderboard } from "@/components/learning/Leaderboard";
import { GameResult } from "@/components/learning/GameResult";
import { SkillRadar } from "@/components/learning/SkillRadar";

const RouletteWheel = dynamic(
  () => import("@/components/learning/RouletteWheel").then((m) => m.RouletteWheel),
  { ssr: false, loading: () => <div className="w-full max-w-[400px] aspect-square bg-surface-2 rounded-full animate-pulse-slow mx-auto" /> }
);
import questionsData from "../../../../data/learning_questions.json";
import teamData from "../../../../data/learning_team.json";

const allQuestions = questionsData as Question[];
const team = teamData as TeamMember[];

export default function TriviaPage() {
  const [gameState, setGameState] = useState<GameState>("idle");
  const [session, setSession] = useState<GameSession | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [selectedPlayerStats, setSelectedPlayerStats] = useState<{
    player: LeaderboardEntry;
    category_stats: CategoryStat[];
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const selectedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch leaderboard
  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch("/api/learning/scores");
      const data = await res.json();
      if (data.scores) setLeaderboard(data.scores);
    } catch (e) {
      console.error("Failed to fetch leaderboard", e);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Handle roulette selection
  const handleSelect = useCallback((member: TeamMember) => {
    setGameState("selected");
    const questions = selectQuestions(allQuestions);
    setSession({
      player: member,
      questions,
      currentIndex: 0,
      score: 0,
      answers: [],
      walkedAway: false,
    });

    // Auto-advance after 2s
    selectedTimerRef.current = setTimeout(() => {
      setGameState("playing");
    }, 2000);
  }, []);

  // Handle direct player selection (skip roulette)
  const handleDirectSelect = useCallback((member: TeamMember) => {
    const questions = selectQuestions(allQuestions);
    setSession({
      player: member,
      questions,
      currentIndex: 0,
      score: 0,
      answers: [],
      walkedAway: false,
    });
    setGameState("playing");
  }, []);

  // Save game results
  const saveGame = useCallback(
    async (finalSession: GameSession) => {
      setSaving(true);
      try {
        await fetch("/api/learning/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            player_name: finalSession.player.name,
            score: finalSession.score,
            questions_answered: finalSession.answers.length,
            walked_away: finalSession.walkedAway,
            responses: finalSession.answers.map((a) => ({
              question_id: a.questionId,
              category: a.category,
              is_correct: a.isCorrect,
            })),
          }),
        });
        await fetchLeaderboard();
      } catch (e) {
        console.error("Failed to save game", e);
      } finally {
        setSaving(false);
      }
    },
    [fetchLeaderboard]
  );

  // Handle answer
  const handleAnswer = useCallback(
    (_optionIndex: number, isCorrect: boolean) => {
      if (!session) return;

      const question = session.questions[session.currentIndex];
      const newAnswers = [
        ...session.answers,
        { questionId: question.id, category: question.category, isCorrect },
      ];

      if (isCorrect) {
        const newIndex = session.currentIndex + 1;
        if (newIndex >= 15) {
          // Won the game!
          const finalSession: GameSession = {
            ...session,
            score: 1_000_000,
            answers: newAnswers,
            currentIndex: newIndex,
          };
          setSession(finalSession);
          setGameState("gameOver");
          saveGame(finalSession);
        } else {
          setSession({
            ...session,
            currentIndex: newIndex,
            score: getCurrentPrize(newIndex - 1),
            answers: newAnswers,
          });
        }
      } else {
        // Wrong answer — fall to checkpoint
        const checkpointScore = getCheckpointScore(session.currentIndex);
        const finalSession: GameSession = {
          ...session,
          score: checkpointScore,
          answers: newAnswers,
        };
        setSession(finalSession);
        setGameState("gameOver");
        saveGame(finalSession);
      }
    },
    [session, saveGame]
  );

  // Handle retire
  const handleRetire = useCallback(() => {
    if (!session) return;
    const finalSession: GameSession = {
      ...session,
      walkedAway: true,
      score: getCurrentPrize(session.currentIndex),
    };
    setSession(finalSession);
    setGameState("gameOver");
    saveGame(finalSession);
  }, [session, saveGame]);

  // Play again
  const handlePlayAgain = useCallback(() => {
    setSession(null);
    setGameState("idle");
    setSelectedPlayerStats(null);
  }, []);

  // View player stats
  const handleSelectPlayer = useCallback(async (name: string) => {
    try {
      const res = await fetch(`/api/learning/scores/${encodeURIComponent(name)}`);
      const data = await res.json();
      if (data.player) {
        setSelectedPlayerStats({
          player: data.player,
          category_stats: data.category_stats,
        });
      }
    } catch (e) {
      console.error("Failed to fetch player stats", e);
    }
  }, []);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (selectedTimerRef.current) clearTimeout(selectedTimerRef.current);
    };
  }, []);

  return (
    <div className="py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">myLearning</h1>
          <p className="text-sm text-text-dim mt-0.5">
            Conocimiento de myHotel — {allQuestions.length} preguntas disponibles
          </p>
        </div>
        {gameState !== "idle" && gameState !== "gameOver" && session && (
          <div className="text-right">
            <div className="text-xs text-text-dim">Jugando</div>
            <div className="text-sm font-semibold text-text">{session.player.name}</div>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main area */}
        <div className="flex-1 min-w-0">
          {/* IDLE — Roulette */}
          {gameState === "idle" && (
            <div className="space-y-8">
              <div className="flex flex-col items-center">
                <RouletteWheel members={team} onSelect={handleSelect} />
              </div>

              {/* Direct selection */}
              <div className="space-y-2">
                <p className="text-xs text-text-dim text-center">
                  O elige directamente:
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {team.map((m) => (
                    <button
                      key={m.initials}
                      onClick={() => handleDirectSelect(m)}
                      className="px-2.5 py-1 text-xs rounded bg-surface-2 text-text-muted hover:bg-accent/10 hover:text-accent transition-colors"
                      title={`${m.name} — ${m.role}`}
                    >
                      {m.initials}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SPINNING — handled by RouletteWheel animation */}
          {gameState === "spinning" && (
            <div className="flex flex-col items-center">
              <RouletteWheel members={team} onSelect={handleSelect} disabled />
            </div>
          )}

          {/* SELECTED — Reveal overlay */}
          {gameState === "selected" && session && (
            <div className="flex flex-col items-center py-16 animate-scale-in">
              <div className="w-24 h-24 rounded-full bg-accent flex items-center justify-center mb-4">
                <span className="text-3xl font-bold text-white">
                  {session.player.initials}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-text">{session.player.name}</h2>
              <p className="text-sm text-text-dim mt-1">{session.player.role}</p>
              <p className="text-xs text-accent mt-3 animate-pulse-slow">
                Preparando preguntas...
              </p>
            </div>
          )}

          {/* PLAYING — Question */}
          {gameState === "playing" && session && (
            <QuestionDisplay
              question={session.questions[session.currentIndex]}
              questionIndex={session.currentIndex}
              onAnswer={handleAnswer}
              onRetire={handleRetire}
            />
          )}

          {/* GAME OVER */}
          {gameState === "gameOver" && session && (
            <div className="space-y-6">
              <GameResult session={session} onPlayAgain={handlePlayAgain} />
              {saving && (
                <p className="text-center text-xs text-text-dim animate-pulse-slow">
                  Guardando resultado...
                </p>
              )}
            </div>
          )}
        </div>

        {/* Sidebar: Leaderboard + Player Stats */}
        <div className="w-full lg:w-96 shrink-0 space-y-6">
          <div className="bg-surface border border-border rounded-lg p-4">
            <h2 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
              <span>Ranking</span>
              <span className="text-xs text-text-dim font-normal">
                ({leaderboard.length} jugadores)
              </span>
            </h2>
            <Leaderboard scores={leaderboard} onSelectPlayer={handleSelectPlayer} />
          </div>

          {/* Player skill radar */}
          {selectedPlayerStats && (
            <div className="bg-surface border border-border rounded-lg p-4 animate-fade-in">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-text">Perfil de habilidades</h2>
                <button
                  onClick={() => setSelectedPlayerStats(null)}
                  className="text-xs text-text-dim hover:text-text"
                >
                  Cerrar
                </button>
              </div>
              <SkillRadar
                categoryStats={selectedPlayerStats.category_stats}
                playerName={selectedPlayerStats.player.player_name}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
