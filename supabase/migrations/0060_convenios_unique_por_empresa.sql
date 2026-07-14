-- ============================================================
-- CONSIGTEC — Multi-tenant (Fase B): convênios apartados por empresa.
-- O mesmo município (pixconsig_convenio_id) pode existir em VÁRIAS empresas.
-- Troca a unicidade global de pixconsig_convenio_id por (empresa_id,
-- pixconsig_convenio_id). Backfill garante empresa_id preenchido.
-- Após 0059. Idempotente. ⚠️ Altera constraint de convenios.
-- ============================================================

-- 1) Garante empresa_id em todos os convênios (segurança) e torna obrigatório.
UPDATE convenios
   SET empresa_id = (SELECT (valor #>> '{}')::uuid FROM configuracoes WHERE chave = 'empresa_raiz')
 WHERE empresa_id IS NULL;
ALTER TABLE convenios ALTER COLUMN empresa_id SET NOT NULL;

-- 2) Troca a unicidade: global → por empresa.
ALTER TABLE convenios DROP CONSTRAINT IF EXISTS convenios_pixconsig_convenio_id_key;
-- (NULLS DISTINCT: convênios manuais com pix id nulo não colidem entre si.)
CREATE UNIQUE INDEX IF NOT EXISTS convenios_empresa_pix_key
  ON convenios (empresa_id, pixconsig_convenio_id);

-- índice de apoio para os filtros por empresa
CREATE INDEX IF NOT EXISTS idx_convenios_empresa_id ON convenios (empresa_id);
