# PRD: myHotel Academy — Trivia Game

**Producto:** myHotel Labs → Learning → Trivia
**Autor:** Andrés (Product Owner)
**Versión:** 1.0
**Fecha:** 2026-03-26
**Estado:** Ready for Development

---

## 1. Problema

El equipo de myHotel no tiene una forma estructurada ni entretenida de aprender sobre el producto. El conocimiento queda atrapado en documentación estática que nadie revisa. Cuando llegan personas nuevas, el onboarding sobre funcionalidades del producto es lento y depende de la buena voluntad de los seniors.

## 2. Objetivo

Crear un módulo de trivia gamificado dentro de myHotel Labs que:

1. **Enseñe** sobre el producto myHotel de forma entretenida (Concierge, Semantic Engine, integraciones, roadmap, etc.).
2. **Mida** el nivel de conocimiento individual y del equipo con un ranking persistente.
3. **Genere engagement** usando mecánicas de juego: ruleta para selección de jugador, formato "¿Quién quiere ser millonario?" con 15 preguntas escalables, checkpoints y acumulación de puntos.

## 3. Usuario principal

**Equipo interno de myHotel** (producto, desarrollo, CSMs, soporte). Se usa en reuniones de equipo, sesiones de onboarding o de forma individual.

## 4. Ubicación en la UI

`myHotel Labs → Learning → Trivia`

Nueva sección "Learning" en el sidebar, debajo de Concierge.

---

## 5. Mecánica del juego

### 5.1 Flujo principal

```
[Idle]                    [Spinning]              [Playing]                [Game Over]
Leaderboard +    →    Ruleta gira y     →    15 preguntas         →    Resultado +
botón "Girar"          selecciona jugador      estilo Millonario         puntos al ranking
```

### 5.2 Ruleta de selección

- Rueda giratoria animada con los nombres del equipo.
- Cada segmento tiene un color distinto.
- Gira con desaceleración progresiva (~3-4 segundos).
- Al detenerse, se muestra el jugador seleccionado con una animación de revelación.
- Si se juega individualmente, se puede saltar la ruleta y elegir directamente.

### 5.3 Formato "¿Quién quiere ser millonario?"

**15 preguntas con escalamiento de dificultad y premios:**

| # | Dificultad | Puntos | Checkpoint |
|---|-----------|--------|------------|
| 1 | Fácil | 100 | |
| 2 | Fácil | 200 | |
| 3 | Fácil | 300 | |
| 4 | Fácil | 500 | |
| 5 | Fácil | 1,000 | ✅ |
| 6 | Media | 2,000 | |
| 7 | Media | 4,000 | |
| 8 | Media | 8,000 | |
| 9 | Media | 16,000 | |
| 10 | Media | 32,000 | ✅ |
| 11 | Difícil | 64,000 | |
| 12 | Difícil | 125,000 | |
| 13 | Difícil | 250,000 | |
| 14 | Difícil | 500,000 | |
| 15 | Difícil | 1,000,000 | ✅ |

**Reglas:**

- Cada pregunta tiene 4 alternativas (A, B, C, D). Solo una es correcta.
- **Respuesta correcta**: avanza a la siguiente pregunta.
- **Respuesta incorrecta**: cae al último checkpoint alcanzado (0, 1,000 o 32,000 puntos).
- **Retirarse**: el jugador puede retirarse en cualquier momento y conservar los puntos de la pregunta actual.
- Los puntos ganados se acumulan en el ranking personal.

### 5.4 Selección de preguntas

- Las preguntas se cargan de un banco de preguntas (`learning_questions.json`).
- Para cada juego, se seleccionan 15 preguntas aleatoriamente respetando la dificultad requerida por nivel (5 fáciles, 5 medias, 5 difíciles).
- No se repiten preguntas dentro de un mismo juego.
- El banco de preguntas se genera externamente vía LLM sobre la base de conocimiento de myHotel.

---

## 6. Banco de preguntas

### 6.1 Schema

```json
{
  "id": "q-concierge-001",
  "question": "¿Cuál es el nombre del bot de IA que responde a huéspedes en Concierge?",
  "options": ["Luna", "Estrella", "Sol", "Aurora"],
  "correct": 1,
  "difficulty": "easy",
  "category": "Concierge",
  "explanation": "El bot se llama Estrella y maneja las respuestas automatizadas del Concierge."
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | Identificador único. Formato: `q-{category}-{number}` |
| `question` | string | Texto de la pregunta |
| `options` | string[4] | Exactamente 4 alternativas |
| `correct` | number (0-3) | Índice de la respuesta correcta |
| `difficulty` | `"easy"` \| `"medium"` \| `"hard"` | Nivel de dificultad |
| `category` | string | Categoría temática (Concierge, Semantic, PMS, Integraciones, etc.) |
| `explanation` | string | Explicación que se muestra después de responder |

### 6.2 Categorías (banco actual: 200 preguntas)

**Fidelity Suite (136 preguntas):**
- `Online` (24): IRO, OTAs, Collect, Smart Replies, set competitivo, demografía, comparación.
- `OnSite` (20): Encuestas during-stay, NPS, tasa datos válidos, áreas, tendencias.
- `Desk` (18): Casos manuales e inteligentes, etapas, tipos incidente, prioridades, vistas.
- `Concierge` (16): WhatsApp bot, base conocimiento (16 áreas), personalidad, campañas.
- `Semántico` (15): Índice semántico, menciones, perfección, mínimos de caracteres.
- `Fidelity General` (14): 6 roles, PreStay, navegación, alertas, API.
- `FollowUp` (13): Encuestas post-stay, canales, tasa respuesta.
- `Integraciones` (10): PMS, Google, Booking, Tripadvisor, Expedia, Facebook.
- `Corporativo` (6): Cadenas, vista consolidada, comparación propiedades.

**Travel Tech SaaS (29 preguntas):** PMS, Channel Manager, RMS, OTA, Booking Engine, CRS, GDS, CRM, metasearch, rate parity, comisiones.

**Hotel Knowledge (35 preguntas):** RevPAR, ADR, ocupación, TRevPAR, GOPPAR, walk-in, no-show, overbooking, yield management, upselling, night audit, room types, meal plans.

**Dificultad:** 57 easy, 77 medium, 66 hard.

### 6.3 Estado del banco

- **200 preguntas** listas en `data/learning_questions.json`.
- Para actualizar: editar el JSON o regenerar vía LLM y redeploy.
- Cada 15 preguntas del juego se seleccionan aleatoriamente sin repetir.

---

## 7. Equipo (jugadores)

### 7.1 Fuente

Lista hardcoded en `learning_team.json`. Se edita manualmente cuando cambia el equipo.

### 7.2 Schema

```json
{
  "name": "María García",
  "initials": "MG",
  "role": "CSM"
}
```

El campo `role` es opcional y solo informativo (se puede mostrar en la ruleta o el leaderboard).

---

## 8. Persistencia

### 8.1 Rankings (PostgreSQL)

**Tabla `learning_scores`:**

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | SERIAL PK | Auto-increment |
| `player_name` | VARCHAR(100) UNIQUE | Nombre del jugador (match con team JSON) |
| `total_score` | BIGINT DEFAULT 0 | Puntos acumulados de todos los juegos |
| `games_played` | INTEGER DEFAULT 0 | Total de juegos jugados |
| `best_score` | INTEGER DEFAULT 0 | Mayor puntaje en un solo juego |
| `highest_question` | INTEGER DEFAULT 0 | Pregunta más alta alcanzada (1-15) |
| `updated_at` | TIMESTAMP | Última partida |

**Tabla `learning_games` (historial):**

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | SERIAL PK | Auto-increment |
| `player_name` | VARCHAR(100) | Jugador |
| `score` | INTEGER | Puntos ganados en este juego |
| `questions_answered` | INTEGER | Preguntas respondidas (1-15) |
| `walked_away` | BOOLEAN | Si se retiró voluntariamente |
| `played_at` | TIMESTAMP | Fecha y hora |

### 8.2 API Routes

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/learning/scores` | GET | Ranking completo (ordenado por total_score desc) |
| `/api/learning/scores` | POST | Registrar resultado de juego. Body: `{ player_name, score, questions_answered, walked_away }` |
| `/api/learning/scores/[name]` | GET | Stats de un jugador específico |

La ruta POST hace upsert: si el jugador ya existe, acumula puntos y actualiza stats. Si no, lo crea.

---

## 9. Componentes UI

### 9.1 Layout de la página

```
┌─────────────────────────────────────────────────────────┐
│  myHotel Academy                              [Stats]   │
├──────────────────────────────┬──────────────────────────┤
│                              │                          │
│     Zona principal           │     Leaderboard          │
│     (Ruleta / Pregunta /     │     (ranking persistente │
│      Resultado)              │      + stats)            │
│                              │                          │
└──────────────────────────────┴──────────────────────────┘
```

**Mobile:** stack vertical, leaderboard debajo.

### 9.2 Componentes

| Componente | Responsabilidad |
|-----------|----------------|
| `RouletteWheel` | SVG con segmentos de colores, animación de giro, callback con jugador seleccionado |
| `QuestionDisplay` | Pregunta + 4 opciones + escalera de premios lateral + botón retirarse |
| `Leaderboard` | Tabla de ranking con total_score, games_played, best_score. Top 3 destacados |
| `GameResult` | Pantalla de fin de juego: puntos ganados, si acertó/falló/se retiró, animación |

### 9.3 Estados del juego

```
idle → spinning → selected → playing → gameOver → idle
```

| Estado | Vista | Acción de salida |
|--------|-------|-----------------|
| `idle` | Leaderboard + botón "Girar la Ruleta" | Click en girar |
| `spinning` | Ruleta girando | Animación termina |
| `selected` | Jugador revelado (pausa 2s) | Auto-avance |
| `playing` | QuestionDisplay con pregunta actual | Responder / Retirarse |
| `gameOver` | GameResult con resumen | Click "Jugar de nuevo" |

---

## 10. Estilo visual

- Consistente con el design system de myHotel Labs (colores accent indigo, surface/border tokens, font Inter).
- Ruleta: colores vibrantes para los segmentos, con nombres legibles.
- Pregunta: fondo oscuro (accent/indigo) para el panel de pregunta, opciones como botones grandes clicables.
- Escalera de premios: lateral derecha, pregunta actual highlighted en dorado/amber.
- Leaderboard: medallas para top 3 (🥇🥈🥉), tabla con hover states.
- Animaciones: fade-in, confetti al ganar el millón, shake al fallar.

---

## 11. Decisiones técnicas

| Decisión | Elección | Razón |
|----------|---------|-------|
| Framework | Next.js App Router (existente) | Consistencia con el resto de Labs |
| Preguntas | JSON estático | Simpleza. Se genera offline vía LLM. No requiere admin UI |
| Ranking | PostgreSQL (existente) | Ya hay conexión configurada. Persistencia real |
| Animación ruleta | CSS transitions + SVG | Sin dependencias extra. Performance nativa |
| State management | useState local en page | No requiere contexto global. Juego es self-contained |

---

## 12. Fuera de alcance (v1)

- Admin UI para gestionar preguntas (se edita el JSON directamente).
- Lifelines (50/50, llamar a un amigo, etc.). Candidato para v2.
- Multiplayer en tiempo real. Solo turno individual.
- Generación on-the-fly de preguntas vía LLM (latencia inaceptable para gameplay).
- Timer por pregunta. Candidato para v2.
- Categorías seleccionables por juego. Candidato para v2.

---

## 13. Métricas de éxito

- **Adopción**: ≥80% del equipo ha jugado al menos una vez en el primer mes.
- **Engagement**: Promedio ≥2 juegos por persona por semana.
- **Conocimiento**: Mejoría medible en highest_question promedio del equipo a lo largo del tiempo.

---

## 14. Roadmap

### v1 (MVP)
- Ruleta + Millonario + Leaderboard + Banco de preguntas JSON + Ranking persistente.

### v2
- Timer por pregunta (15/30/45 seg según dificultad).
- Lifelines: 50/50 (elimina 2 opciones), Pregunta al equipo (votación), Saltar (1 uso).
- Filtro por categoría antes de iniciar.
- Estadísticas detalladas por categoría (fortalezas/debilidades del equipo).

### v3
- Generación de preguntas vía LLM on-demand (con cache).
- Modo competencia: 2 jugadores responden la misma pregunta, gana el más rápido.
- Integración con onboarding: asignar categorías obligatorias a nuevos integrantes.

---

## 15. Archivos de entrada (listos para desarrollo)

| Archivo | Ubicación | Descripción |
|---------|-----------|-------------|
| Banco de preguntas | `data/learning_questions.json` | 200 preguntas validadas con schema definido arriba |
| Equipo | `data/learning_team.json` | Lista de jugadores (editar con nombres reales) |
| PRD | `docs/PRD-Learning-Trivia.md` | Este documento |

**Contexto técnico del proyecto:**
- Framework: Next.js 16 App Router + TypeScript + Tailwind CSS 4
- DB: PostgreSQL via `src/lib/db.ts` (pool existente)
- Estilos: `src/app/globals.css` (tokens de colores, animaciones)
- Navegación: `src/components/Sidebar.tsx` (agregar sección Learning)
- Layout: `src/app/layout.tsx` (sidebar + main content)
- Patrón existente de API routes: `src/app/api/*/route.ts`

**Instrucción para Claude Code:** Lee este PRD completo, los archivos de datos (`data/learning_questions.json`, `data/learning_team.json`), el Sidebar existente, el layout, y los estilos globales. Luego implementa la feature completa siguiendo las especificaciones de este documento.
