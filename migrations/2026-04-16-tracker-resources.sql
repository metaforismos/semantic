-- Tracker — observaciones crudas de recursos 3rd-party + catálogo global
-- Ver docs/PRD-Tracker.md §10. Discovery-first: capturamos cada host
-- observado en el HTML de un hotel (script, iframe, link, anchor de
-- reserva) sin asumir vendor. El catálogo global agrega por dominio
-- registrable y permite clasificación diferida por LLM.

-- Una fila por (hotel, host). Multiple contextos se guardan en JSONB.
CREATE TABLE IF NOT EXISTS tracker_hotel_resources (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id           UUID NOT NULL REFERENCES tracker_hotels(id) ON DELETE CASCADE,
  host               TEXT NOT NULL,              -- ej. "book.siteminder.com"
  registrable_domain TEXT NOT NULL,              -- ej. "siteminder.com"
  contexts           JSONB NOT NULL,             -- [{type, url, snippet, section}]
  role_hint          TEXT,                       -- booking_engine|cms|analytics|chat|reviews|ads|cdn|fonts|maps|video|unknown
  analysis_url       TEXT,                       -- URL final analizada que originó la observación
  first_seen_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tracker_hotel_resources_hotel_host
  ON tracker_hotel_resources (hotel_id, host);
CREATE INDEX IF NOT EXISTS idx_tracker_hotel_resources_domain
  ON tracker_hotel_resources (registrable_domain);
CREATE INDEX IF NOT EXISTS idx_tracker_hotel_resources_role
  ON tracker_hotel_resources (role_hint);

-- Catálogo global: una fila por dominio registrable, agregando hoteles
-- que lo tienen. vendor_name/product vienen de rule match o clasificación LLM.
CREATE TABLE IF NOT EXISTS tracker_resources (
  registrable_domain TEXT PRIMARY KEY,
  primary_role       TEXT,                       -- rol mayoritario observado
  observed_hotels    INTEGER NOT NULL DEFAULT 0, -- cuántos hoteles distintos lo tienen
  observed_contexts  INTEGER NOT NULL DEFAULT 0, -- total de observaciones (1 hotel puede tener varias)
  vendor_name        TEXT,                       -- nombre canónico (ej. "SiteMinder")
  vendor_product     TEXT,                       -- ej. "The Booking Button"
  classified_by      TEXT,                       -- rule | llm | manual | null
  classified_at      TIMESTAMPTZ,
  classification_notes TEXT,                     -- reasoning del LLM, evidencia manual
  first_seen_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracker_resources_role
  ON tracker_resources (primary_role);
CREATE INDEX IF NOT EXISTS idx_tracker_resources_observed_hotels
  ON tracker_resources (observed_hotels DESC);
CREATE INDEX IF NOT EXISTS idx_tracker_resources_unclassified
  ON tracker_resources (observed_hotels DESC) WHERE classified_by IS NULL;
