-- Tracker — dedup por URL canonical (Fase 1D.9)
-- website_url_canonical es una forma normalizada del website del hotel:
-- host sin www + path sin trailing slash. Permite que el mismo hotel
-- llegando por dos vías (seed CSV y bulk URL) se reconozca sin duplicar.
--
-- Esquema de ID layered:
--   1. id (UUID)           — PK interna inmutable.
--   2. external_id         — UNIQUE cuando presente, para seeds y CRMs externos.
--   3. website_url_canonical — UNIQUE cuando presente, dedup por sitio oficial.

ALTER TABLE tracker_hotels
  ADD COLUMN IF NOT EXISTS website_url_canonical TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tracker_hotels_website_canonical
  ON tracker_hotels (website_url_canonical)
  WHERE website_url_canonical IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tracker_hotels_website_canonical
  ON tracker_hotels (website_url_canonical)
  WHERE website_url_canonical IS NOT NULL;

-- Index para query "hoteles con URL sin analizar todavía" que usa el
-- botón Enqueue pendientes del Browse.
CREATE INDEX IF NOT EXISTS idx_tracker_hotels_pending_analysis
  ON tracker_hotels (last_enriched_at NULLS FIRST, id)
  WHERE website_url IS NOT NULL;
