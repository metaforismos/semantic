import type { PipelinePrompt, ConversationQualityAnalysis, WorkerAttribution } from "./quality-types";
import type { Conversation } from "./types";

export function buildQualityEvalSystemPrompt(activePrompts: PipelinePrompt[]): string {
  const promptsSection = activePrompts
    .map(
      (p) =>
        `### ${p.prompt_key} (v${p.version})\n**System prompt:**\n${p.system_template.slice(0, 2000)}${p.system_template.length > 2000 ? "\n[...truncated...]" : ""}\n**User template:**\n${p.user_template.slice(0, 500)}${p.user_template.length > 500 ? "\n[...truncated...]" : ""}`
    )
    .join("\n\n");

  return `Eres un evaluador experto de calidad conversacional para un pipeline multi-agente de concierge de hotel.

## Pipeline del Concierge

El pipeline funciona así:
1. INTENT_CLASSIFIER clasifica el intent del mensaje del huésped.
2. Según el intent, se rutea a un worker especializado:
   - KNOWLEDGE_QA → QUERY_REWRITER → RAG → QA_WORKER
   - SMALLTALK → SMALLTALK_WORKER
   - TOURISM_INFO → TOUR_GUIDE (web search)
   - SERVICE_REQUEST → SERVICE_REQUEST_WORKER
   - UNKNOWN/BLOCKED → respuesta directa
   - Ambiguo → INQUIRER (pregunta clarificadora)
3. SYNTHESIZER pule la respuesta del worker.
4. AUDITOR es la puerta de seguridad (aprueba/revisa/bloquea).

Worker paralelo: SURVEY_WINDOW_WORKER (cuando hay encuesta activa).

## Prompts Activos del Pipeline

${promptsSection}

## 7 Dimensiones de Calidad

### 1. hallucination (Hallucination Rate)
El agente afirma algo no soportado por el contexto. Se infiere cuando:
- Provee datos muy específicos (precios, horarios, teléfonos) que no aparecen en el contexto visible.
- Fabrica una dirección completa a partir solo del nombre de la ciudad.
- Inventa servicios o capacidades del hotel.
**Worker típico:** QA_WORKER o SYNTHESIZER.

### 2. false_agency (False Agency Rate)
El agente promete o implica acciones que no puede ejecutar:
- Usa frases como "he registrado", "he reservado", "voy a coordinar", "voy a enviar".
- Implica capacidad operativa: "su pedido llegará pronto".
**Worker típico:** SYNTHESIZER o QA_WORKER.

### 3. avoidable_derivation (Avoidable Derivation Rate)
El agente deriva al huésped a recepción cuando podría haber resuelto. Clasifica:
- Derivación necesaria: no puede resolver (acción física, dato no disponible).
- Derivación evitable por KB: el dato podría estar pero no está. Responsabilidad del hotel.
- Derivación evitable por prompt: el prompt es muy conservador.
- Derivación evitable por arquitectura: el pipeline no pasa suficiente contexto.
**Worker típico:** QA_WORKER, SERVICE_REQUEST_WORKER, INTENT_CLASSIFIER.

### 4. resolution (Resolution Rate)
El huésped obtiene una respuesta útil y completa. Se mide por:
- El huésped agradece o muestra satisfacción.
- No repite la misma pregunta reformulada.
- No abandona tras una respuesta insatisfactoria.
**Worker típico:** depende del intent.

### 5. tone (Tone Quality Score)
Evalúa si el tono es natural, apropiado y consistente:
- Tono robótico o excesivamente formal.
- Respuesta excesivamente larga para una pregunta simple.
- Uso inapropiado de emojis.
- Inconsistencia de personalidad entre mensajes.
**Worker típico:** SYNTHESIZER, SMALLTALK_WORKER.

### 6. language_match (Language Match Rate)
El agente responde en el idioma del huésped:
- Huésped escribe en portugués, agente responde en español.
- Mezcla de idiomas en la misma respuesta.
**Worker típico:** todos, pero SYNTHESIZER define el idioma final.

### 7. continuity (Continuity Rate)
Coherencia y retención de contexto en conversación multi-turno:
- Ignora contexto de mensajes anteriores.
- Repite información ya proporcionada.
- Responde como si fuera el primer mensaje ("¡Hola! ¿En qué puedo ayudar?" en el mensaje 5).
- No conecta una confirmación ("sí, por favor") con lo que propuso.
- Repite la misma solución que el huésped ya dijo que no funciona.
**Worker típico:** INTENT_CLASSIFIER, QA_WORKER, SYNTHESIZER.
**Nota arquitectónica:** Si un worker no recibe conversation_history, las rupturas son problema de arquitectura, no de prompt.

## Instrucciones

Para cada conversación, evalúa las 7 dimensiones y produce un JSON estructurado.

### Scoring
Cada dimensión de 1 (crítico) a 5 (excelente):
- 5: Sin problemas detectados
- 4: Problemas menores que no afectan la experiencia
- 3: Problemas moderados que degradan la experiencia
- 2: Problemas serios que frustran al huésped
- 1: Problemas críticos (hallucination, false agency grave, etc.)

### overall_quality_score
Promedio ponderado sugerido: hallucination(2x), false_agency(2x), resolution(1.5x), continuity(1.5x), avoidable_derivation(1x), tone(1x), language_match(1x).

### Severity
- critical: Impacto directo en confianza o satisfacción del huésped
- high: Problema significativo que degrada la experiencia
- medium: Problema notable pero tolerable
- low: Problema menor, mejora cosmética

### Attribution
Atribuye cada issue al worker ESPECÍFICO responsable basándote en los prompts del pipeline. Si el problema se origina en un worker pero se amplifica en otro (ej: QA_WORKER genera dato falso, SYNTHESIZER lo embellece), atribuye al worker que ORIGINA el problema.

## Formato de salida

Responde SOLO con un JSON array. Sin texto adicional.

\`\`\`json
[
  {
    "conversation_id": "conv002",
    "customer_id": 684,
    "overall_quality_score": 2.5,
    "dimensions": {
      "hallucination": { "score": 5, "issues": [] },
      "false_agency": {
        "score": 1,
        "issues": [
          {
            "message_order": 5,
            "text_fragment": "He registrado su solicitud de transfer",
            "severity": "high",
            "responsible_worker": "SYNTHESIZER",
            "explanation": "QA_WORKER draft no prometía acción, pero SYNTHESIZER reescribió con false agency"
          }
        ]
      },
      "avoidable_derivation": { "score": 4, "issues": [] },
      "resolution": {
        "score": 2,
        "issues": [
          {
            "message_order": 5,
            "severity": "high",
            "responsible_worker": "QA_WORKER",
            "explanation": "Repite la misma solución (extensión 9) que el huésped ya dijo que no funciona"
          }
        ]
      },
      "tone": { "score": 4, "issues": [] },
      "language_match": { "score": 5, "issues": [] },
      "continuity": {
        "score": 1,
        "issues": [
          {
            "message_orders": [3, 5],
            "severity": "critical",
            "responsible_worker": "QA_WORKER",
            "explanation": "Huésped dice 'ya intenté eso y no funciona'. Agente repite la misma solución sin escalar."
          }
        ]
      }
    }
  }
]
\`\`\`

IMPORTANTE:
- Evalúa TODAS las 7 dimensiones para cada conversación.
- Si no hay problemas en una dimensión, score = 5 e issues vacío.
- El text_fragment es opcional pero muy útil para evidencia.
- message_orders (array) se usa cuando el issue involucra múltiples mensajes.
- Temperature 0: sé consistente, objetivo, y crítico. No suavices los problemas.`;
}

export function buildQualityEvalUserMessage(conversations: Conversation[]): string {
  const formatted = conversations.map((conv) => {
    const msgs = conv.messages
      .map(
        (m) =>
          `[${m.message_type}] (order:${m.message_order}) ${m.text}`
      )
      .join("\n");
    return `--- CONVERSACIÓN: ${conv.conversation_id} (hotel: ${conv.customer_id}) ---\n${msgs}`;
  });

  return `Evalúa la calidad de las siguientes ${conversations.length} conversaciones:\n\n${formatted.join("\n\n")}`;
}

export function buildProposalSystemPrompt(activePrompts: PipelinePrompt[]): string {
  const promptsSection = activePrompts
    .map(
      (p) =>
        `### ${p.prompt_key} (v${p.version})\n**System prompt completo:**\n${p.system_template}\n**User template:**\n${p.user_template}`
    )
    .join("\n\n");

  return `Eres un experto en prompt engineering para pipelines multi-agente de concierge de hotel.

Tu tarea es generar propuestas concretas de cambios a prompts basándote en métricas de calidad y evidencia de conversaciones reales.

## Prompts Activos del Pipeline

${promptsSection}

## Tipos de propuesta

- add_rule: Agregar regla a prompt existente. Incluye "location" (sección del prompt) y "text" (la regla).
- modify_rule: Cambiar regla existente. Incluye "location" y "text" (la regla modificada).
- remove_rule: Eliminar regla contraproducente. Incluye "location" y "text" (descripción de qué eliminar).
- architecture: Cambio al pipeline (no prompt). Incluye "description" (qué cambiar).
- new_version: Propuesta de versión completa reescrita. Incluye "text" (el nuevo prompt completo).

## Instrucciones

1. Analiza las métricas y los issues proporcionados.
2. Para cada problema significativo, genera una propuesta concreta.
3. Prioriza por impacto: critical > high > medium > low.
4. Cada propuesta debe tener evidencia (conversation_ids).
5. La propuesta debe ser lo suficientemente específica para ser implementable directamente.
6. Máximo 10 propuestas, ordenadas por prioridad.

## Formato de salida

Responde SOLO con JSON. Sin texto adicional.

\`\`\`json
{
  "proposals": [
    {
      "target_worker": "SYNTHESIZER",
      "target_version": "1.0.1",
      "priority": "critical",
      "category": "false_agency",
      "problem": "Descripción clara del problema",
      "evidence": ["conv003", "conv004"],
      "proposed_change": {
        "type": "add_rule",
        "location": "STRICT RULES section",
        "text": "- NEVER introduce action verbs..."
      }
    }
  ]
}
\`\`\``;
}

export function buildProposalUserMessage(
  workerAttributions: WorkerAttribution[],
  analyses: ConversationQualityAnalysis[],
  dimensionAverages: Record<string, number>
): string {
  const metricsSection = Object.entries(dimensionAverages)
    .map(([dim, avg]) => `- ${dim}: ${avg.toFixed(2)}/5`)
    .join("\n");

  const workerSection = workerAttributions
    .filter((w) => w.total_issues > 0)
    .slice(0, 5)
    .map((w) => {
      const dims = Object.entries(w.by_dimension)
        .filter(([, count]) => count > 0)
        .map(([dim, count]) => `${dim}(${count})`)
        .join(", ");
      const topIssues = w.top_issues
        .slice(0, 3)
        .map((issue) => `  - [${issue.severity}] ${issue.explanation}`)
        .join("\n");
      return `### ${w.worker} (${w.total_issues} issues: ${dims})\n${topIssues}`;
    })
    .join("\n\n");

  // Find worst conversations as evidence
  const worstConversations = [...analyses]
    .sort((a, b) => a.overall_quality_score - b.overall_quality_score)
    .slice(0, 5)
    .map((a) => {
      const dims = Object.entries(a.dimensions)
        .filter(([, d]) => d.issues.length > 0)
        .map(([dim, d]) => `${dim}(score:${d.score}, ${d.issues.length} issues)`)
        .join(", ");
      return `- ${a.conversation_id} (quality: ${a.overall_quality_score.toFixed(1)}): ${dims}`;
    })
    .join("\n");

  return `## Métricas Globales\n${metricsSection}\n\n## Workers con más problemas\n${workerSection}\n\n## Conversaciones con peor calidad\n${worstConversations}\n\nGenera propuestas concretas para mejorar la calidad del pipeline.`;
}
