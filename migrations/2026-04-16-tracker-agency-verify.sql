-- Tracker — verificación LLM de agencias (Fase 1D.10)
-- Cada fila en tracker_hotel_agency puede pasar por un verificador
-- Gemini Flash que responde: ¿es realmente una agencia web, o es
-- ruido/plataforma/theme? Resultado persistido para trazabilidad.

ALTER TABLE tracker_hotel_agency
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS llm_verdict TEXT,  -- agency | platform | noise
  ADD COLUMN IF NOT EXISTS llm_reasoning TEXT;

CREATE INDEX IF NOT EXISTS idx_tracker_hotel_agency_unverified
  ON tracker_hotel_agency (id) WHERE verified_at IS NULL;
