# Learning & Trivia

Gamified product knowledge training for the myHotel internal team. Combines a roulette-based player selection with a "Who Wants to Be a Millionaire" style quiz.

## Sub-features

- **Trivia Game** (`/learning/trivia`) — Roulette picks a player, then 15 questions across 3 difficulty tiers. Includes streak tracking with milestone celebrations.
- **Skills Radar** (`/learning/skills`) — Individual skill assessment visualization across product knowledge areas.
- **Leaderboard** — Persistent ranking sorted by correct answer percentage. Supports player delete.
- **Streak Tracking** — Consecutive correct answer tracking with visual celebrations at milestones.

## Key Files

| Purpose | Path |
|---------|------|
| Trivia page | `src/app/learning/trivia/page.tsx` |
| Skills page | `src/app/learning/skills/page.tsx` |
| Progress API (GET/POST) | `src/app/api/learning/progress/route.ts` |
| Progress by player | `src/app/api/learning/progress/[name]/route.ts` |
| Scores API (GET/POST) | `src/app/api/learning/scores/route.ts` |
| Scores by player | `src/app/api/learning/scores/[name]/route.ts` |
| Game logic | `src/lib/learning/game.ts` |
| Learning types | `src/lib/learning/types.ts` |
| Questions bank | `data/learning_questions.json` |
| Team roster | `data/learning_team.json` |

## UI Components (`src/components/learning/`)

- `RouletteWheel` — Animated player selection wheel
- `QuestionDisplay` — Quiz question with 4 randomized options
- `GameResult` — End-of-game summary with stats
- `Leaderboard` — Ranking table sorted by correct %
- `SkillRadar` — Radar chart for per-area skill visualization
- `ProgressBar` — Question progress indicator
- `StreakCelebration` — Visual milestone animation for streaks

## Game Mechanics

- 200 questions in the bank, 4 options each, organized by difficulty (easy/medium/hard)
- 15 questions per session following the difficulty tier progression
- Quiz options are randomized per question display
- Scores persisted via API (not localStorage)
- Leaderboard sorted by correct answer percentage
- Sticky "Siguiente" (Next) button instead of auto-advance between questions
- Radar chart hidden during active training sessions

## Reference

- `docs/PRD-Learning-Trivia.md` — Full product requirements and game design
