-- ============================================================
-- CONSIGTEC — Multi-tenant: "tipo de empresa" (estrutura societária do modelo
-- antigo) dá lugar a SEGMENTO comercial do cliente (correspondente, promotora,
-- financeira, banco, cooperativa…). Campo apenas informativo p/ organizar a
-- carteira de clientes. A coluna legada `tipo` permanece (escondida na UI) com
-- DEFAULT para não quebrar inserts que não a informem.
-- Após 0063. Idempotente.
-- ============================================================

ALTER TABLE empresas ADD COLUMN IF NOT EXISTS segmento text;
ALTER TABLE empresas ALTER COLUMN tipo SET DEFAULT 'operacional';
