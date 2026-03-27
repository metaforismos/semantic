"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { GameState, GameSession, TeamMember, TrainingProgress, Question } from "@/lib/learning/types";
import dynamic from "next/dynamic";
import { createTrainingOrder, buildQuestionMap } from "@/lib/learning/game";
import { QuestionDisplay } from "@/components/learning/QuestionDisplay";
import { GameResult } from "@/components/learning/GameResult";
import { SkillRadar } from "@/components/learning/SkillRadar";
import questionsData from "../../../../data/learning_questions.json";
import teamData from "../../../../data/learning_team.json";

const RouletteWheel = dynamic(
  () => import("@/components/learning/RouletteWheel").then((m) => m.RouletteWheel),
  { ssr: false, loading: () => <div className="w-full max-w-[400px] aspect-square bg-surface-2 rounded-full animate-pulse-slow mx-auto" /> }
);

const allQuestions = questionsData as Question[];
const team = teamData as TeamMember[];
const questionMap = buildQuestionMap(allQuestions);

export default function TriviaPage() {
  const [gameState, setGameState] = useState<GameState>("idle");
  const [session, setSession] = useState<GameSession | null>(null);
  const [progress, setProgress] = useState<TrainingProgress | null>(null);
  const [saving, setSaving] = useState(false);
  const selectedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autocomplete state
  const [searchText, setSearchText] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [radarOpen, setRadarOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredTeam = searchText.length > 0
    ? team.filter((m) => m.name.toLowerCase().includes(searchText.toLowerCase()))
    : [];

  // Auto-spin trigger for skip
  const autoSpinRef = useRef(false);

  // Initialize or resume a training session for a player
  const initSession = useCallback(async (member: TeamMember) => {
    setSaving(true);
    try {
      // Check existing progress
      const progressRes = await fetch(`/api/learning/progress/${encodeURIComponent(member.name)}`);
      const progressData = await progressRes.json();

      let trainingProgress: TrainingProgress;

      if (progressData.progress && progressData.progress.question_order.length > 0 && !progressData.progress.completed) {
        // Resume existing session
        trainingProgress = progressData.progress;
      } else {
        // Create new training order
        const order = createTrainingOrder(allQuestions);
        const initRes = await fetch("/api/learning/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ player_name: member.name, init: true, question_order: order }),
        });
        const initData = await initRes.json();
        trainingProgress = initData.progress;
      }

      setProgress(trainingProgress);

      // Build question list from order
      const questions = trainingProgress.question_order
        .map((id) => questionMap.get(id))
        .filter((q): q is Question => q != null);

      setSession({
        player: member,
        questions,
        currentIndex: trainingProgress.current_index,
        answeredCount: trainingProgress.answered_ids.length,
        correctCount: trainingProgress.correct_ids.length,
        totalQuestions: questions.length,
        answers: [],
      });

      setGameState("playing");
    } catch (e) {
      console.error("Failed to init session", e);
    } finally {
      setSaving(false);
    }
  }, []);

  // Handle roulette selection
  const handleRouletteSelect = useCallback((member: TeamMember) => {
    setGameState("selected");
    // Store member temporarily — auto-advance or skip
    setSession({
      player: member,
      questions: [],
      currentIndex: 0,
      answeredCount: 0,
      correctCount: 0,
      totalQuestions: 0,
      answers: [],
    });

    selectedTimerRef.current = setTimeout(() => {
      initSession(member);
    }, 3000);
  }, [initSession]);

  // Handle skip (absent user)
  const handleSkip = useCallback(() => {
    if (selectedTimerRef.current) clearTimeout(selectedTimerRef.current);
    setSession(null);
    setGameState("idle");
    autoSpinRef.current = true;
  }, []);

  // Handle autocomplete select
  const handleAutocompleteSelect = useCallback((member: TeamMember) => {
    setSearchText("");
    setShowDropdown(false);
    initSession(member);
  }, [initSession]);

  // Handle answer
  const handleAnswer = useCallback(
    async (_optionIndex: number, isCorrect: boolean) => {
      if (!session || !progress) return;

      const question = session.questions[session.currentIndex];

      // Save to DB
      await fetch("/api/learning/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player_name: session.player.name,
          question_id: question.id,
          is_correct: isCorrect,
          category: question.category,
        }),
      });

      const newAnswered = session.answeredCount + 1;
      const newCorrect = session.correctCount + (isCorrect ? 1 : 0);
      const nextIndex = session.currentIndex + 1;

      if (nextIndex >= session.totalQuestions) {
        // Training complete!
        setSession({ ...session, answeredCount: newAnswered, correctCount: newCorrect, currentIndex: nextIndex });
        setGameState("gameOver");
      } else {
        setSession({
          ...session,
          currentIndex: nextIndex,
          answeredCount: newAnswered,
          correctCount: newCorrect,
        });
      }
    },
    [session, progress]
  );

  // Handle timeout (auto-skip)
  const handleTimeout = useCallback(async () => {
    if (!session) return;

    const question = session.questions[session.currentIndex];

    // Skip in DB — advance index only
    await fetch("/api/learning/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        player_name: session.player.name,
        question_id: question.id,
        skip: true,
      }),
    });

    const nextIndex = session.currentIndex + 1;
    if (nextIndex >= session.totalQuestions) {
      setGameState("gameOver");
    } else {
      setSession({ ...session, currentIndex: nextIndex });
    }
  }, [session]);

  // Play again
  const handlePlayAgain = useCallback(() => {
    setSession(null);
    setProgress(null);
    setGameState("idle");
    setSearchText("");
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (selectedTimerRef.current) clearTimeout(selectedTimerRef.current);
    };
  }, []);

  // Auto-spin after skip
  const rouletteRef = useRef<{ triggerSpin: () => void } | null>(null);
  useEffect(() => {
    if (gameState === "idle" && autoSpinRef.current) {
      autoSpinRef.current = false;
      // Small delay so roulette renders first
      setTimeout(() => {
        rouletteRef.current?.triggerSpin();
      }, 500);
    }
  }, [gameState]);

  return (
    <div className="py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">Entrenamiento</h1>
          <p className="text-sm text-text-dim mt-0.5">
            Conocimiento de myHotel — {allQuestions.length} preguntas
          </p>
        </div>
        {gameState === "playing" && session && (
          <div className="text-right">
            <div className="text-xs text-text-dim">Entrenando</div>
            <div className="text-sm font-semibold text-text">{session.player.name}</div>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main area */}
        <div className="flex-1 min-w-0">
          {/* IDLE — Roulette + Autocomplete */}
          {gameState === "idle" && (
            <div className="space-y-8">
              <div className="flex flex-col items-center">
                <RouletteWheel members={team} onSelect={handleRouletteSelect} />
              </div>

              {/* Autocomplete name picker */}
              <div className="max-w-sm mx-auto space-y-2">
                <p className="text-xs text-text-dim text-center">
                  O busca tu nombre para entrenar:
                </p>
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchText}
                    onChange={(e) => {
                      setSearchText(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                    placeholder="Escribe tu nombre..."
                    className="w-full px-4 py-2.5 text-sm bg-surface border border-border rounded-lg text-text placeholder:text-text-dim focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                  />
                  {showDropdown && filteredTeam.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
                      {filteredTeam.map((m) => (
                        <button
                          key={m.name}
                          onMouseDown={() => handleAutocompleteSelect(m)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2 transition-colors"
                        >
                          <span className="text-sm font-medium text-text">{m.name}</span>
                          <span className="text-xs text-text-dim">{m.role}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {saving && (
                  <p className="text-center text-xs text-text-dim animate-pulse-slow">
                    Cargando sesión...
                  </p>
                )}
              </div>
            </div>
          )}

          {/* SELECTED — Reveal + Skip */}
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
              <button
                onClick={handleSkip}
                className="mt-6 px-6 py-2 text-sm text-text-dim border border-border rounded-lg hover:bg-surface-2 hover:text-text transition-colors"
              >
                Saltar — no está presente
              </button>
            </div>
          )}

          {/* PLAYING — Question */}
          {gameState === "playing" && session && session.currentIndex < session.totalQuestions && (
            <QuestionDisplay
              question={session.questions[session.currentIndex]}
              questionIndex={session.currentIndex}
              totalQuestions={session.totalQuestions}
              answeredCount={session.answeredCount}
              correctCount={session.correctCount}
              onAnswer={handleAnswer}
              onTimeout={handleTimeout}
            />
          )}

          {/* GAME OVER — Completion */}
          {gameState === "gameOver" && session && (
            <GameResult
              playerName={session.player.name}
              answeredCount={session.answeredCount}
              correctCount={session.correctCount}
              totalQuestions={session.totalQuestions}
              onPlayAgain={handlePlayAgain}
            />
          )}
        </div>

        {/* Sidebar: Radar overview — only on idle */}
        {gameState === "idle" && (
          <div className="w-full lg:w-96 shrink-0 space-y-6">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setRadarOpen(true)}
              onKeyDown={(e) => { if (e.key === "Enter") setRadarOpen(true); }}
              className="bg-surface border border-border rounded-lg p-4 hover:border-accent/30 transition-colors cursor-pointer"
            >
              <h2 className="text-sm font-semibold text-text mb-1">Áreas de evaluación</h2>
              <p className="text-xs text-text-dim mb-3">
                Temas que se cubren en el entrenamiento
              </p>
              <SkillRadar
                categoryStats={[]}
                playerName="Equipo myHotel"
              />
              <p className="text-[10px] text-accent mt-2 text-center">Click para ampliar</p>
            </div>
          </div>
        )}
      </div>

      {/* Radar lightbox modal */}
      {radarOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setRadarOpen(false)}
        >
          <div
            className="bg-surface rounded-2xl p-8 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-text">Áreas de evaluación</h2>
                <p className="text-xs text-text-dim">
                  11 áreas de conocimiento cubiertas en el entrenamiento
                </p>
              </div>
              <button
                onClick={() => setRadarOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-2 text-text-dim hover:text-text transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
            <SkillRadar
              categoryStats={[]}
              playerName="Equipo myHotel"
            />
          </div>
        </div>
      )}
    </div>
  );
}
