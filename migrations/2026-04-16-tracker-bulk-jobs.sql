-- Tracker — jobs de análisis masivo (Fase 1D)
-- Modelo pull-based: el job guarda los items pending en Postgres.
-- El UI llama POST /api/tracker/bulk/:id/run repetidamente para procesar
-- batches pequeños (5-10 items cada 30-60s) hasta agotar la cola.
-- No requiere Redis ni worker externo.

CREATE TABLE IF NOT EXISTS tracker_bulk_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label         TEXT,
  total         INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'created', -- created | running | done | error
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tracker_bulk_jobs_created
  ON tracker_bulk_jobs (created_at DESC);

CREATE TABLE IF NOT EXISTS tracker_bulk_job_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           UUID NOT NULL REFERENCES tracker_bulk_jobs(id) ON DELETE CASCADE,
  idx              INTEGER NOT NULL,           -- orden original del CSV
  url              TEXT NOT NULL,
  input            JSONB NOT NULL DEFAULT '{}'::jsonb, -- { name, city, country, external_id, is_customer }
  status           TEXT NOT NULL DEFAULT 'pending', -- pending | running | done | error | skipped
  hotel_id         UUID,
  result_summary   JSONB,                      -- detections, resources_count, insecure_tls, etc.
  error            TEXT,
  started_at       TIMESTAMPTZ,
  finished_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tracker_bulk_items_job_status
  ON tracker_bulk_job_items (job_id, status);
CREATE INDEX IF NOT EXISTS idx_tracker_bulk_items_job_idx
  ON tracker_bulk_job_items (job_id, idx);
