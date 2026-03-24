import { CONCIERGE_TOPICS } from "./types";
import type { Conversation } from "./types";

export function buildAnalysisSystemPrompt(): string {
  return `Eres un analista experto en experiencia de huéspedes de hotel. Analizas conversaciones entre huéspedes y un asistente virtual (concierge) de hotel.

Tu tarea es analizar cada conversación y producir un JSON estructurado.

## Vocabulario controlado de temas
Usa SOLO estos temas para clasificar:
${CONCIERGE_TOPICS.map((t) => `- ${t}`).join("\n")}

## Instrucciones por conversación

Para cada conversación, determina:

1. **satisfaction_score** (1-5): Inferido del tono del huésped.
   - 5: Muy satisfecho, agradece explícitamente
   - 4: Satisfecho, consulta resuelta sin problemas
   - 3: Neutral, interacción funcional
   - 2: Algo insatisfecho, muestra frustración leve
   - 1: Muy insatisfecho, enojado o queja explícita

2. **satisfaction_signal**: Texto corto justificando el score (máx 20 palabras).

3. **topics**: Array de temas consultados del vocabulario controlado. Puede ser más de uno.

4. **ia_messages**: Array con una entrada por CADA mensaje de tipo IA en la conversación:
   - **message_order**: int (el message_order del mensaje IA)
   - **derived**: boolean — true si ese mensaje específico deriva al huésped a un ser humano (recepción, extensión, "comuníquese con...", "le sugiero contactar a...", etc.)
   - **derivation_reason**: texto corto si derived == true, vacío si false

5. **is_success_case**: boolean — true solo si satisfaction_score >= 4 AND ningún mensaje IA es derivado AND el huésped envió 3+ mensajes.

6. **success_summary**: Si is_success_case == true, resumen de 1-2 oraciones de por qué fue exitoso. Vacío si false.

## Formato de salida

Responde SOLO con un JSON array. Sin texto adicional. Ejemplo:

\`\`\`json
[
  {
    "conversation_id": "abc123",
    "satisfaction_score": 4,
    "satisfaction_signal": "Huésped agradeció la información",
    "topics": ["Check-in / Check-out", "Transporte / Transfers"],
    "ia_messages": [
      { "message_order": 2, "derived": false, "derivation_reason": "" },
      { "message_order": 4, "derived": true, "derivation_reason": "Derivó a recepción por consulta de reserva" }
    ],
    "is_success_case": false,
    "success_summary": ""
  }
]
\`\`\`

IMPORTANTE:
- Analiza TODOS los mensajes IA de cada conversación, no solo el último.
- derived se evalúa por MENSAJE, no por conversación.
- Si no hay suficiente contexto para inferir satisfacción, usa 3 (neutral).
- Temperature 0: sé consistente y objetivo.`;
}

export function buildAnalysisUserMessage(conversations: Conversation[]): string {
  const formatted = conversations.map((conv) => {
    const msgs = conv.messages
      .map(
        (m) =>
          `[${m.message_type}] (order:${m.message_order}) ${m.text}`
      )
      .join("\n");
    return `--- CONVERSACIÓN: ${conv.conversation_id} ---\n${msgs}`;
  });

  return `Analiza las siguientes ${conversations.length} conversaciones:\n\n${formatted.join("\n\n")}`;
}
