# PRD: Concierge Pilot Report

**Producto:** myHotel Labs → Concierge → Pilot Report
**Autor:** Andrés (Product Owner)
**Versión:** 1.3
**Fecha:** 2026-03-24
**Estado:** Draft

---

## 1. Problema

El equipo de CSM no tiene una herramienta estandarizada para evaluar el rendimiento de un piloto de Concierge en un hotel. Hoy el análisis es manual, inconsistente y no produce un entregable presentable al hotel. Esto retrasa la conversión de pilotos a contratos.

## 2. Objetivo

Dar al CSM una herramienta que, a partir de un CSV de mensajes exportado desde Concierge, genere automáticamente:

1. Un **reporte visual exportable a PDF** con métricas, casos de éxito y recomendaciones.
2. Un **JSON estructurado** con contexto y métricas listo para alimentar herramientas externas de generación de contenido (e.g. NotebookLM).

El reporte debe convencer al hotel de contratar Concierge. El framing es siempre positivo: los problemas se plantean como oportunidades de mejora vía completación de base de conocimiento (responsabilidad del hotel) o features en roadmap 2026.

## 3. Usuario principal

**CSM de myHotel** (interno). No es self-service para el hotel.

## 4. Ubicación en la UI

`myHotel-Labs → Concierge → Pilot Report`

myHotel-Labs es el sitio donde se desarrollará esta herramienta. Pilot Report es la primera herramienta de Concierge disponible ahí.

## 5. Input

### 5.1 CSV de mensajes

Schema pre-existente (ya definido por el equipo). El CSM exporta el CSV desde la plataforma y lo carga en la herramienta. Separador: tab.

| Campo CSV | Tipo | Uso en el reporte |
|---|---|---|
| `customer_id` | int | ID del hotel. Se usa para construir enlaces a conversaciones (`customer_id` en la URL). |
| `customer_name` | string | Nombre del hotel. Se extrae automáticamente del CSV → no requiere input manual. |
| `conversation_id` | string (hash) | Agrupar mensajes en conversaciones y construir enlaces. |
| `external_line` | string | Número de teléfono del huésped. Se usa para: (a) contar huéspedes únicos, (b) dato válido para Tasa de Datos Válidos. |
| `message_type` | enum | Quién escribe. Valores posibles: `Campaign` (mensaje automatizado de campaña), `Human` (huésped), `IA` (bot Estrella), `Survey` (encuesta). |
| `campaign` | string | Tipo de campaña: `PreStay`, `Welcome`, u otro. Vacío si `message_type` ≠ `Campaign`/`Survey`. Se usa para Tasa de Interacción por origen. |
| `template` | string | Template específico usado. Informativo; no se usa en métricas core. |
| `sent_at` | datetime | Fecha y hora de envío. Para ordenar mensajes y calcular tiempos de respuesta. |
| `message_order` | int | Orden secuencial del mensaje dentro de la conversación. Respaldo para ordenamiento si `sent_at` tiene empates. |
| `conversation_text` | string | Texto del mensaje. Input para análisis semántico (temas, satisfacción, calidad, resolución vs deflexión). |

**Nota importante sobre `message_type`:** En la etapa piloto no existen agentes humanos del hotel interviniendo en las conversaciones. Todo es 100% IA. Esto implica que no hay un tipo `Agent` o `Human_Agent` en el CSV. Si en futuras versiones se incorporan agentes, se deberá agregar un nuevo valor al enum (ver §14).

**Nota sobre email:** El CSV no contiene email del huésped. La Tasa de Datos Válidos en este reporte se calcula solo sobre teléfono (`external_line` presente y válido). Si se requiere incluir email, se debe extender el schema del CSV.

### 5.2 Metadata manual (formulario en UI)

El CSM completa al cargar el CSV:

- Período del piloto (fecha inicio – fecha fin) — se auto-sugiere a partir de `min(sent_at)` / `max(sent_at)` del CSV, editable.
- Notas adicionales (opcional, texto libre)

`customer_id` y `customer_name` se extraen automáticamente del CSV.

## 6. Procesamiento

### 6.1 Reconstrucción de conversaciones

Agrupar mensajes por `conversation_id`, ordenar por `message_order` (con `sent_at` como tiebreaker). Cada conversación queda como un hilo completo con turnos clasificados:

- **`Campaign`** / **`Survey`**: Mensajes salientes automatizados (el "primer contacto"). Marcan el origen de la interacción.
- **`Human`**: Mensajes del huésped.
- **`IA`**: Respuestas del bot (Estrella).

Una conversación se considera **activa** (con interacción) si contiene al menos un mensaje `Human` posterior al primer `Campaign` o `Survey`.

### 6.2 Motor de análisis: LLM (Claude API)

Se usa Claude API (Sonnet) para el análisis semántico. Justificación: los mensajes son lenguaje natural en español con alta variabilidad, abreviaciones y contexto hotelero. Las heurísticas no escalan bien para inferir satisfacción ni clasificar temas con precisión.

**Análisis por conversación (batch):**

Se envían las conversaciones reconstruidas a Claude con un prompt estructurado que solicita por cada conversación:

```
- satisfaction_score: 1-5 (inferido del tono del huésped)
- satisfaction_signal: texto corto justificando el score
- topics: array de temas consultados (vocabulario controlado, ver §6.3)
- ia_messages: array con una entrada por cada mensaje de tipo IA en la conversación:
    - message_order: int
    - derived: boolean — true si ese mensaje específico deriva al huésped a un
      ser humano (recepción, extensión 9, "comuníquese con...", etc.)
    - derivation_reason: texto corto si derived == true
- is_success_case: boolean (satisfacción >= 4, 0 mensajes derivados, interacción de 3+ turnos del huésped)
- success_summary: texto corto si is_success_case == true
```

**Nota sobre derivación:** Se clasifica **por mensaje IA**, no por conversación. Una misma conversación puede tener mensajes derivados y no derivados. La Tasa de Automatización se calcula como: `(mensajes IA no derivados / total mensajes IA) × 100%`.

**Procesamiento en batches** de ~20 conversaciones por llamada para optimizar costo y latencia. El prompt incluye el vocabulario de temas y las instrucciones de scoring para garantizar consistencia.

### 6.3 Vocabulario controlado de temas

Categorías base (extensibles por hotel):

- Check-in / Check-out
- WiFi / Conectividad
- Room Service
- Housekeeping
- Reservas de restaurante
- Amenities (piscina, spa, gym)
- Reclamos / Problemas en habitación
- Transporte / Transfers
- Información turística
- Facturación
- Otro

### 6.4 Cálculo de métricas

Las métricas deben calzar con el lenguaje y estructura del dashboard actual de Concierge (ver referencia visual). Se calculan:

| Métrica | Cálculo | Equivalencia dashboard |
|---|---|---|
| **Tasa de Datos Válidos** | % de `external_line` con formato de teléfono válido sobre total de conversaciones únicas. Nota: email no disponible en CSV actual; reportar solo teléfono. | Tasa de Datos Válidos (parcial — solo teléfono) |
| **Tasa de Interacción** | Conversaciones con ≥1 mensaje `Human` / total conversaciones (que tienen al menos un `Campaign` o `Survey`) | Tasa de Interacción |
| **Tasa de Interacción por origen** | Tasa de interacción segmentada por campo `campaign` del primer mensaje `Campaign`/`Survey` de cada conversación (PreStay, Welcome, OnSite, etc.) | Tasa de Interacción por origen |
| **Tasa de Automatización** | Mensajes IA con `derived == false` / total mensajes IA × 100%. Se mide a nivel de mensaje individual. **Framing dashboard:** "X de Y mensajes se resolvieron sin necesidad de derivar a un ser humano." | Tasa de Automatización |
| **Tasa de Derivación** | Mensajes IA con `derived == true` / total mensajes IA × 100%. Complemento de automatización. **Framing positivo:** "X% de los mensajes pueden resolverse completando la base de conocimiento." | Nueva — inversa de automatización |
| **Tiempo ahorrado** | (Total mensajes IA) × (benchmark tiempo respuesta humana − mediana tiempo respuesta IA). Benchmark humano: **12 minutos** (dato del dashboard actual, configurable por CSM). | Tiempo ahorrado |
| **Tiempo de respuesta (Estrella)** | Mediana de `sent_at(IA) − sent_at(Human)` para pares consecutivos Human→IA | Tiempo de respuesta |
| **Satisfacción inferida** | Distribución de `satisfaction_score` (1-5) agregada sobre conversaciones activas | Nueva — complementa las existentes |
| **Top temas consultados** | Ranking de `topics` por frecuencia, agregado sobre todas las conversaciones activas | Nueva |
| **Top motivos de derivación** | Ranking de `derivation_reason` por frecuencia sobre mensajes IA con `derived == true`. Alimenta directamente la sección de oportunidades de mejora. | Nueva |

### 6.5 Selección de casos de éxito

Filtrar conversaciones donde `is_success_case == true` (satisfacción ≥ 4, `derived == false`, interacción de 3+ turnos del huésped). Ordenar por `satisfaction_score` desc. Tomar top 3-5. Para cada una, generar:

- Resumen corto (del LLM)
- Temas tratados
- Enlace directo: `https://fidelity.myhotel.cl/concierge/conversations?conversationId={conversation_id}&customer_id={customer_id}`

## 7. Outputs

### 7.1 Reporte visual (PDF)

Presentación de ~8-12 páginas. Estructura:

1. **Portada** — Logo myHotel, nombre del hotel, período del piloto.
2. **Resumen ejecutivo** — 3-4 bullet points con los highlights. Tono: "Concierge atendió X huéspedes, resolvió Y% de consultas automáticamente y ahorró Z horas de trabajo manual."
3. **Métricas principales** — Cards visuales replicando el estilo del dashboard actual:
   - Tasa de Datos Válidos (donut chart + nota: solo teléfono en v1)
   - Tasa de Interacción (donut chart + ratio)
   - Tasa de Interacción por origen (barras horizontales por campaign)
   - Tasa de Automatización (donut chart + ratio mensajes IA no derivados / total mensajes IA)
   - Tiempo ahorrado (big number + equivalencia en tareas manuales)
   - Tiempo de respuesta (big number Estrella vs benchmark humano 12 min)
4. **Satisfacción inferida** — Distribución del score 1-5, porcentaje positivo (4+5).
5. **Temas más consultados** — Top 10 con barras horizontales y porcentaje.
6. **Análisis de derivaciones** — Top motivos de derivación con framing positivo: "Oportunidades de resolución directa". Cada motivo se traduce en una acción concreta (completar base de conocimiento o feature en roadmap).
7. **Casos de éxito** — 3-5 mini casos con resumen + enlace a conversación.
7. **Oportunidades de mejora** — Framing positivo:
   - Temas con baja resolución → "Completar base de conocimiento en [tema]"
   - Baja tasa de interacción en algún origen → "Optimizar mensaje de [campaign]"
   - Features pendientes → "En roadmap 2026: [feature]"
8. **Conclusión y próximos pasos** — Call to action para contratar. Propuesta de valor reforzada con los datos del piloto.

**Diseño visual:** Consistente con el design system de **myHotel-Labs** (no FidelitySuite). Seguir las convenciones gráficas, paleta de colores, tipografía y componentes establecidos en myHotel-Labs. El CSM debe definir o proveer la guía de estilo de referencia.

### 7.2 JSON estructurado

```json
{
  "meta": {
    "hotel_name": "Las Americas Torre Del Mar",
    "hotel_id": 684,
    "period_start": "2026-02-22",
    "period_end": "2026-03-24",
    "tone": "positive",
    "generated_at": "2026-03-24T12:00:00Z",
    "report_version": "1.0",
    "total_conversations": 350,
    "active_conversations": 283
  },
  "metrics": {
    "valid_data_rate": {
      "phone": 0.67,
      "note": "Email no disponible en CSV. Solo se evalúa teléfono."
    },
    "interaction_rate": {
      "overall": 0.28,
      "contacted": 1019,
      "responded": 283
    },
    "interaction_by_origin": [
      { "origin": "PreStay", "rate": 0.54, "responded": 152, "contacted": 282 },
      { "origin": "Welcome", "rate": 0.28, "responded": 98, "contacted": 353 },
      { "origin": "OnSite", "rate": 0.06, "responded": 17, "contacted": 282 }
    ],
    "automation_rate": {
      "rate": 0.95,
      "not_derived": 836,
      "derived": 44,
      "total_ia_messages": 880,
      "label": "mensajes de Estrella que resolvieron sin derivar a un ser humano"
    },
    "derivation_rate": {
      "rate": 0.05,
      "top_reasons": [
        { "reason": "Información de habitación específica no disponible", "count": 14, "pct": 0.32 },
        { "reason": "Solicitud que requiere acción humana (reserva, cambio)", "count": 11, "pct": 0.25 },
        { "reason": "Datos de contacto o extensiones internas", "count": 8, "pct": 0.18 }
      ]
    },
    "time_saved": {
      "hours": 16.9,
      "equivalent_manual_tasks": 203,
      "equivalent_task_label": "Notas de bienvenida personalizadas a mano",
      "human_benchmark_minutes": 12
    },
    "response_time": {
      "bot_median_seconds": 5,
      "human_benchmark_minutes": 12
    },
    "inferred_satisfaction": {
      "distribution": { "1": 12, "2": 25, "3": 48, "4": 102, "5": 96 },
      "positive_rate": 0.70,
      "positive_label": "% de huéspedes con satisfacción 4 o 5"
    },
    "top_topics": [
      { "topic": "Check-in / Check-out", "count": 87, "pct": 0.31 },
      { "topic": "Transporte / Transfers", "count": 52, "pct": 0.18 },
      { "topic": "Información de contacto", "count": 45, "pct": 0.16 }
    ]
  },
  "success_cases": [
    {
      "conversation_id": "d7be870de629294183ec846d4f021df4",
      "summary": "Huésped consultó sobre traslado al aeropuerto y teléfonos del hotel. Estrella resolvió ambas consultas en tiempo real.",
      "satisfaction_score": 5,
      "topics": ["Transporte / Transfers", "Información de contacto"],
      "url": "https://fidelity.myhotel.cl/concierge/conversations?conversationId=d7be870de629294183ec846d4f021df4&customer_id=684"
    }
  ],
  "improvement_opportunities": [
    {
      "area": "Base de conocimiento",
      "detail": "Completar información sobre tipos de habitación y disponibilidad para reducir derivaciones en consultas de reserva.",
      "owner": "hotel",
      "impact": "Podría resolver ~30% de las derivaciones actuales."
    },
    {
      "area": "Base de conocimiento",
      "detail": "Agregar información sobre Business Center y espacios de trabajo.",
      "owner": "hotel",
      "impact": "Consulta recurrente sin respuesta directa."
    },
    {
      "area": "Roadmap 2026",
      "detail": "Integración con PMS para consultas de habitación en tiempo real, eliminando la necesidad de derivar a recepción.",
      "owner": "myhotel",
      "impact": "Podría resolver ~25% de las derivaciones actuales."
    }
  ]
}
```

## 8. Flujo del CSM

```
1. CSM navega a myHotel-Labs → Concierge → Pilot Report
2. Completa formulario: nombre hotel, período, notas
3. Carga CSV
4. Sistema valida schema del CSV (campos requeridos presentes, tipos correctos)
   → Si falla: mensaje de error específico indicando qué falta
5. Sistema procesa (barra de progreso):
   a. Reconstruye conversaciones
   b. Calcula métricas cuantitativas
   c. Envía conversaciones a Claude API (batches)
   d. Agrega resultados del LLM
   e. Selecciona casos de éxito
   f. Genera PDF
   g. Genera JSON
6. CSM descarga PDF y/o JSON
7. CSM envía PDF al hotel como entregable de evaluación del piloto
8. CSM pega JSON en NotebookLM u otra herramienta para generar contenido adicional
```

## 9. Reglas de negocio

- El reporte **nunca usa lenguaje negativo**. Toda métrica baja se enmarca como oportunidad.
- Las oportunidades de mejora siempre se atribuyen a una de dos causas: (a) base de conocimiento incompleta (acción del hotel) o (b) feature en roadmap 2026 (acción de myHotel).
- El JSON incluye el campo `tone: "positive"` para que herramientas downstream respeten el framing.
- Los enlaces a conversaciones solo se incluyen en casos de éxito, nunca en casos problemáticos.
- **Derivación ≠ fallo.** El reporte presenta las derivaciones como "consultas que hoy se derivan a recepción y que mañana Estrella podrá resolver directamente". Nunca como errores del bot.
- El benchmark de tiempo de respuesta humano (12 min) se presenta como dato de referencia de la industria/plataforma, no como crítica al hotel específico.
- Si la tasa de automatización (resolved) es ≥ 80%, se califica como "Excelente". Entre 60-80% como "Buena". < 60% como "Con alto potencial de crecimiento".
- Si no hay conversaciones activas suficientes para una métrica, se omite la métrica con nota explicativa en vez de mostrar datos poco representativos.

## 10. Validaciones del CSV

| Validación | Comportamiento si falla |
|---|---|
| Campos requeridos presentes (`customer_id`, `conversation_id`, `message_type`, `sent_at`, `message_order`, `conversation_text`) | Error bloqueante. Lista campos faltantes. |
| `conversation_id` no vacío | Warning. Filas sin ID se descartan con conteo en log. |
| `sent_at` parseable como datetime | Warning. Filas con timestamp inválido se descartan. |
| `message_type` ∈ {Campaign, Human, IA, Survey} | Warning. Valores desconocidos se marcan como `unknown` y se excluyen del análisis. |
| Mínimo 10 conversaciones activas (con ≥1 mensaje `Human`) | Error bloqueante. "El CSV no contiene suficientes conversaciones con interacción para generar un reporte representativo." |
| `customer_id` consistente en todo el CSV | Error bloqueante. "El CSV contiene datos de múltiples hoteles." |
| `message_order` es numérico y sin duplicados dentro de cada `conversation_id` | Warning. Se reordena por `sent_at` si hay inconsistencias. |

## 11. Consideraciones técnicas

- **Claude API:** Modelo Sonnet. Prompt versionado y almacenado. Temperature 0 para consistencia.
- **Batching:** ~20 conversaciones por llamada. Conversaciones largas (>50 mensajes) se envían solas.
- **Costo estimado:** ~$0.02-0.05 por conversación analizada. Para un piloto típico (~300 conversaciones): ~$6-15 USD.
- **Generación PDF:** Server-side. Librería a definir por engineering (Puppeteer + HTML template o equivalente).
- **Sin persistencia de reportes en v1.** El CSM descarga y listo. Historial de reportes queda para v2.
- **Rate limiting:** Un reporte a la vez por CSM. Cola si hay concurrencia.

## 12. Métricas de éxito del feature

- **Adopción:** 80% de evaluaciones de piloto usan esta herramienta en los primeros 3 meses.
- **Conversión:** Aumento en tasa de conversión piloto → contrato (baseline a medir antes del lanzamiento).
- **Tiempo:** Reducción del tiempo que toma al CSM producir un reporte de evaluación (de ~4h manual a <30 min).

## 13. Fuera de scope (v1)

- Comparación entre hoteles.
- Reportes periódicos automáticos (sin carga de CSV).
- Edición del reporte dentro de la herramienta.
- Multiidioma (solo español en v1).
- Integración directa con NotebookLM API.
- Persistencia / historial de reportes generados.

## 14. Roadmap tentativo

| Fase | Alcance | Timeline |
|---|---|---|
| **v1.0** | CSV → PDF + JSON. Análisis LLM. Métricas core. Derivación clasificada por mensaje IA (flag binaria). | Q2 2026 |
| **v1.1** | Historial de reportes. Templates de reporte customizables. Soporte para `message_type: Agent` cuando se incorporen agentes humanos (Tasa de Automatización real: bot vs humano). | Q3 2026 |
| **v2.0** | Sin CSV: lectura directa de BD. Reportes programados. Comparación entre hoteles. | Q4 2026 |