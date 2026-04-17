# Tracker

Base de datos viva de hoteles en LatAm + USA. Descubre el stack tecnológico real de cada hotel (booking engine, CMS, PMS, chat, analytics, reviews, ads, agencia web), detecta si es cadena o independiente, y agrega todo en un catálogo global consultable por zona geográfica o por vendor. Fuente para prospección comercial myHotel y para inteligencia competitiva.

Ver PRD completo en [`docs/PRD-Tracker.md`](../PRD-Tracker.md). Este documento explica cómo está construido el sistema hoy.

## Roadmap por fases

| Fase | Qué | Estado |
|------|-----|--------|
| 0 | Fundación (schema DB + seed CSV + shell UI) | Completa |
| 1A | Detector por reglas + `/tracker/search` con persistencia | Completa |
| 1B | Discovery mode (observaciones + catálogo global + stats) | Completa |
| 1B.7 | Clasificación LLM de dominios unknown (Gemini Flash) | Completa |
| 1C | OTA linkage (Booking/Expedia/TripAdvisor con SerpAPI) | Pendiente |
| 1D | Bulk CSV + pull-based job queue + export | Completa |
| 1D.6 | Heurísticas de subdomain + detección de cadena + síntesis de stack | Completa |
| 1D.7 | Detección de agencia web + self-hosted fallback | Completa |
| 1D.8 | Parser robusto de CSV/URLs + file picker + auto-classify loop | Completa |
| 1D.9 | `website_url_canonical` + cascada de ID + enqueue pendientes | WIP |
| 1E | Headless browser fallback (Playwright) para sitios JS-heavy | Pendiente |
| 2 | Discovery geográfico (Google Places, Mapbox, SerpAPI) | Pendiente |
| 3 | Contactos (Apollo + Hunter + LinkedIn) — requiere gate legal | Pendiente |
| 4 | Prospecting multicanal + voz — requiere gate legal | Pendiente |

## Arquitectura del pipeline

```
URL → fetch HTML (con fallback TLS relajado)
    → detect (reglas hotel-specific + observaciones crudas)
        ├─ rules: data/tracker/rules/*.json matchean signatures
        │         (script_src, iframe_src, link_href, meta_generator, html)
        ├─ resources: cada host 3rd-party con role_hint inferido
        ├─ chain: señales de cadena (anchors a /hotel/<slug>, JSON-LD, frases)
        ├─ agency: "powered by / hecho por / designed by"
        └─ self-hosted: form action interno a reservas.php, extensiones .php/.aspx
    → synthesizeStack (regla > LLM > dominio crudo por categoría)
    → persist en Postgres (7+ tablas en una transacción)
    → post: LLM clasifica los dominios unknown del catálogo (fuera del hot path)
```

## Reglas de arquitectura

1. **Discovery-first, no rule-first.** Las reglas JSON (Fase 1A) etiquetan lo conocido pero no son el gateway. Toda observación cruda (host, contexto, sección) se persiste aunque no matchee ninguna regla. El LLM completa vendor_name después por catálogo deduplicado.
2. **Identificador de hotel es una cascada, no un único campo.** Un hotel puede llegar por seed CSV (`external_id`), por URL bulk (`website_url_canonical`), por Discovery geográfica (`name+city+country+lat/lng`), o por input manual. `resolveHotel()` en `analyze.ts` intenta identificar en orden antes de crear nuevo.
3. **LLM nunca en el hot path del batch.** `analyzeUrl()` es puro fetch + rules + discovery; clasificación LLM corre al terminar el batch sobre el catálogo global deduplicado (1 LLM call por dominio único, no por hotel).
4. **Confianza siempre, nunca booleanos colapsados.** Detections guardan `confidence` (0–1) y `evidence[]`. El catálogo guarda `classified_by` (`rule` | `llm` | `manual`) + `classification_notes`.
5. **Nunca sobrescribir stack al cambiar.** `tracker_hotel_stack` usa UPSERT por `(hotel_id, category, vendor)` actualizando `last_seen_at`. Cambios disruptivos se registran en `tracker_hotel_events`.
6. **Reintento TLS relajado sólo cuando el cert falla.** `fetcher.ts` cae a `undici` con `rejectUnauthorized: false` si ve `UNABLE_TO_VERIFY_LEAF_SIGNATURE`/`CERT_HAS_EXPIRED`/etc. `insecure_tls: true` marca estos análisis para trazabilidad.
7. **LLM override beats subdomain heuristics cuando confianza ≥ 0.85.** Permite corregir casos donde `cdn.tambourine.com` quedó como `cdn` por heurística pero es realmente una plataforma CMS hotelera.

## Esquema de identificador

Sistema layered para dedupe robusto cuando el mismo hotel entra por distintas vías.

| Nivel | Campo | Uso |
|-------|-------|-----|
| 1 | `tracker_hotels.id` (UUID) | PK interna, inmutable, siempre presente |
| 2 | `tracker_hotels.external_id` | UNIQUE cuando presente. Se usa para seeds (`id_hotel` del CSV) y sistemas externos (HubSpot, CRMs) |
| 3 | `tracker_hotels.website_url_canonical` | UNIQUE cuando presente. Generado por `canonicalizeUrl()` = `host-sin-www + path-sin-trailing + query-ordenada-sin-trackers`. Dedup por sitio oficial |
| 4 | `tracker_hotel_urls.url` | Tabla separada. Un hotel puede tener N URLs (oficial, landing, subdominios) |
| 5 | `(slug(canonical_name), country, lat/lng)` | Fallback fuzzy sin UNIQUE. Se usará en Fase 2 Discovery |

Cascada en `resolveHotel()`:
1. `explicit_hotel_id` si viene en el request.
2. Match por `external_id` si prefill lo provee.
3. Match por `website_url_canonical` (calculado del `final_url` después del follow-redirects).
4. Match por `tracker_hotel_urls.url` exacta (re-análisis).
5. Crear nuevo hotel.

## Discovery mode — distinción clave

**Tres niveles de conocimiento por recurso 3rd-party:**

| Nivel | Fuente | `tracker_resources.classified_by` | Cómo se llega |
|-------|--------|-----------------------------------|---------------|
| Regla | `data/tracker/rules/*.json` matchea | `rule` | Detección durante `analyze` |
| LLM | Gemini Flash clasificó el dominio con evidencia | `llm` | Trigger post-batch o manual en `/tracker/resources` |
| Heurística | Inferido por host pattern / subdomain / contexto | `null` | `resources.ts` `inferRoleFromContext` |

**Sin doble clasificación:** un dominio se clasifica por LLM **una sola vez en la historia** del catálogo. Re-análisis de hoteles no dispara re-LLMar el mismo dominio. Hay un flag `reclassify: true` para forzar.

## Tablas

| Tabla | Qué guarda | Notas |
|-------|-----------|-------|
| `tracker_hotels` | Identidad canónica del hotel | `is_customer`, `is_chain`, `chain_signals`, `website_url_canonical`, `external_id` |
| `tracker_hotel_urls` | URLs asociadas al hotel | UNIQUE (hotel_id, url). Múltiples por hotel OK |
| `tracker_hotel_stack` | Tecnologías detectadas por reglas | vendor, product, category, confidence, evidence jsonb, active |
| `tracker_hotel_resources` | Cada host 3rd-party observado por hotel | UNIQUE (hotel_id, host). `role_hint` + `contexts` jsonb |
| `tracker_resources` | Catálogo global agregado | PK = `registrable_domain`. `primary_role`, `observed_hotels`, `vendor_name`, `classified_by` |
| `tracker_hotel_agency` | Agencia web detectada por "powered by" | UNIQUE (hotel_id, agency_name). `agency_url`, `evidence`, `confidence` |
| `tracker_hotel_ota_presence` | Presencia en OTAs | v1C (todavía no poblada). UNIQUE (hotel_id, ota) |
| `tracker_hotel_events` | Auditoría de cambios | `event_type` = 'analyze' | 'stack_change' | 'ota_added' |
| `tracker_hotel_sources` | Payload raw por fuente | `source` = 'csv_seed_2025_06' | 'rule_analyzer_v1' | futuro: 'mapbox' | 'serpapi' |
| `tracker_bulk_jobs` | Jobs de análisis masivo | status = created/running/done. 1 fila por batch CSV |
| `tracker_bulk_job_items` | URLs de cada job | status = pending/running/done/error. `result_summary` jsonb con el stack sintetizado |

## Archivos clave

| Propósito | Ruta |
|-----------|------|
| Schema (migrations) | `migrations/2026-04-16-tracker-*.sql` |
| Seed CSV import | `scripts/tracker/import-seed.mjs` (filtra OTAs para website_url) |
| Migration runner | `scripts/tracker/apply-migration.mjs` |
| Fetcher HTTP | `src/lib/tracker/fetcher.ts` (UA realista, timeout 15s, TLS relajado fallback via undici) |
| URL canonicalización | `canonicalizeUrl()` en `fetcher.ts` |
| Motor de detección por reglas | `src/lib/tracker/detector.ts` |
| Extracción de observaciones | `src/lib/tracker/resources.ts` (subdomain heuristics + role inference) |
| Chain detection | `src/lib/tracker/chain.ts` (anchors, JSON-LD, frases) |
| Agency detection | `src/lib/tracker/agency.ts` (regex "powered by" en footer) |
| Self-hosted fallback | `src/lib/tracker/selfhosted.ts` (form internos + .php/.aspx) |
| Stack synthesis | `src/lib/tracker/stack.ts` (`synthesizeStack`, `compactStackSummary`) |
| Pipeline integrado | `src/lib/tracker/analyze.ts` (fetch + detect + persist + enrich from catalog) |
| LLM classifier | `src/lib/tracker/llm-classifier.ts` (Gemini Flash, JSON output, maxTokens=2000 por thinking budget) |
| Reglas JSON | `data/tracker/rules/booking-engines.json`, `cms.json`, `widgets.json` |
| Rutas API | `src/app/api/tracker/{hotels, analyze, resources, stats, bulk}/` |
| UI | `src/app/tracker/{search, browse, bulk, resources, stats}/` + `src/components/tracker/` |

## Flujo del Bulk (pull-based job queue)

**Por qué pull-based y no push:** Next.js serverless no tiene workers de background. Redis+BullMQ era overkill para v1. Solución: el cliente (browser) hace polling de `POST /api/tracker/bulk/:id/run` hasta agotar los pendientes.

```
1. POST /api/tracker/bulk          → crea job + N items pending
2. POST /api/tracker/bulk/:id/run   → claim FOR UPDATE SKIP LOCKED
                                       procesa 5 con concurrencia 3
                                       actualiza items + result_summary
3. Loop client-side hasta remaining=0
4. GET  /api/tracker/bulk/:id/export?format=csv
```

El checkbox **"Clasificar unknowns al terminar"** dispara `POST /api/tracker/resources/classify { batch, min_hotels:1, limit:40 }` hasta 10 pasadas. Procesa sólo dominios únicos del catálogo (dedupe global), no por hotel. LLM call ~1.6s por dominio.

## Anti-patterns (qué NO hacer)

1. **No persistir nada sin `evidence`.** Cada detection y cada observación lleva `evidence_url` o `contexts[]` con snippet matched. Sin eso, debugging a escala es imposible.
2. **No colapsar `role_hint` a "unknown" sólo porque no matcheó una regla.** Las heurísticas de contexto (iframe en `/book*` → booking_engine) importan antes que la clasificación LLM.
3. **No llamar al LLM por cada URL analizada.** El LLM clasifica dominios únicos del catálogo. La misma cookielaw.org aparece en 50 hoteles pero se clasifica una sola vez.
4. **No mezclar detection.vendor con resource.vendor_name sin chequear categoría.** Antes del fix de 1D.6, Bootstrap (category=other) aparecía como booking engine de `motor.fnsbooking.com` porque el rule match del link CSS se atribuía al host. Ahora `vendor_compatible = det.category === resource.role_hint`.
5. **No importar URLs OTA al seed de hoteles.** `url_1..url_10` del CSV scraper tiene `booking.com`, `tripadvisor.com` — no son sitios oficiales. El importer filtra OTAs antes de asignar `website_url`.
6. **No `pushed to prod sin confirmar deploy.** Railway auto-deploya desde git. Cambios de DB schema aplicados con `apply-migration.mjs` van a la misma DB que producción (no hay DB dev separada — confirmar antes de migrar en sesiones grandes).
7. **No saltarse la cascada de `resolveHotel`.** Si un endpoint crea hoteles con `INSERT` directo saltando la cascada, genera duplicados cuando el mismo hotel vuelve por otra vía. Todo INSERT debe pasar por `resolveHotel()`.
8. **No scrapear directo Booking/Expedia.** Fase 1C usa SerpAPI/Serper para dejar esa zona gris fuera de nuestra infra (menos riesgo, menos mantención).
9. **No tocar el hot path con operaciones de red externa.** Clasificación LLM es post-batch. Geocoding, Apollo/Hunter (Fase 3), voz (Fase 4) también fuera del pipeline de analyze.

## Configuración requerida

Variables de entorno (Railway prod + `.env.local`):

| Variable | Uso | Cuándo |
|----------|-----|--------|
| `DATABASE_URL` | Postgres Railway | Siempre |
| `GEMINI_API_KEY` | LLM classification | 1B.7 en adelante |
| `SERPAPI_KEY` o `SERPER_API_KEY` | OTA linkage + Discovery | Fase 1C / 2 |
| `APOLLO_API_KEY`, `HUNTER_API_KEY` | Contactos | Fase 3 (gate legal primero) |

## Métricas de éxito

- **v1 (actual):** cobertura observaciones ≥95% (los sitios que responden reciben ≥1 observación), top-20 dominios del catálogo con vendor labeled. Verificable en `/tracker/stats`.
- **v2:** 200k+ hoteles en base tras Discovery geográfico; tasa de dedupe correcto ≥95%.
- **v3:** ≥1 contacto decisor en 60% de la base enriquecida.
- **v4:** response rate cross-canal superior al baseline manual Sales.

## Postura legal

PO decidió **postura agresiva** (ver PRD §6). LinkedIn scraping y voz outbound quedan pendientes de revisión con abogado **antes de producción** (gate legal entre Fase 2 y 3). Scraping de Booking/TripAdvisor/Expedia se hace vía SerpAPI (zona gris con mejor defensibilidad). Datos personales de decisores bajo interés legítimo B2B.
