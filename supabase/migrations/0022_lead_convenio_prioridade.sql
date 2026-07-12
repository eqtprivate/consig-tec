-- ============================================================
-- CONSIGTEC — Lead associado a convênio/município (herda prioridade
-- comercial). Base para a fila de discagem priorizada. Após 0021.
-- Idempotente.
-- ============================================================
ALTER TABLE leads ADD COLUMN IF NOT EXISTS convenio_id uuid REFERENCES convenios(id);
CREATE INDEX IF NOT EXISTS idx_leads_convenio ON leads(convenio_id);
