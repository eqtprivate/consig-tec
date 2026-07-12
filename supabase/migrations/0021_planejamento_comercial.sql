-- ============================================================
-- CONSIGTEC — Planejamento comercial: prioridade por convênio/município
-- (definição do comercial) + metas comerciais por competência.
-- O call center/CRM passa a ser orientado por prioridade e metas.
-- Aplicar após 0020. Idempotente.
-- ============================================================

DO $$ BEGIN CREATE TYPE prioridade_comercial AS ENUM
  ('alta','media','baixa','sem_prioridade'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Prioridade e potencial do convênio (município), definidos pelo comercial
ALTER TABLE convenios ADD COLUMN IF NOT EXISTS prioridade_comercial prioridade_comercial NOT NULL DEFAULT 'sem_prioridade';
ALTER TABLE convenios ADD COLUMN IF NOT EXISTS potencial_vendas int;      -- capacidade estimada (nº de vendas/mês)
ALTER TABLE convenios ADD COLUMN IF NOT EXISTS observacao_comercial text;
CREATE INDEX IF NOT EXISTS idx_convenios_prioridade ON convenios(prioridade_comercial);

-- ------------------------------------------------------------
-- METAS COMERCIAIS (por convênio/município × competência)
-- convenio_id NULL = meta geral da franquia/grupo.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS metas_comerciais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convenio_id uuid REFERENCES convenios(id) ON DELETE CASCADE,
  franquia_id uuid REFERENCES franquias(id),
  competencia text NOT NULL,                -- 'YYYY-MM'
  meta_vendas int,
  meta_valor numeric(14,2),
  responsavel_id uuid REFERENCES usuarios(id),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (convenio_id, competencia, franquia_id)
);
CREATE INDEX IF NOT EXISTS idx_metas_com_competencia ON metas_comerciais(competencia);
CREATE INDEX IF NOT EXISTS idx_metas_com_convenio ON metas_comerciais(convenio_id);

DROP TRIGGER IF EXISTS trg_metas_com_updated ON metas_comerciais;
CREATE TRIGGER trg_metas_com_updated BEFORE UPDATE ON metas_comerciais FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE metas_comerciais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS metas_com_read ON metas_comerciais;
CREATE POLICY metas_com_read ON metas_comerciais FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS metas_com_admin ON metas_comerciais;
CREATE POLICY metas_com_admin ON metas_comerciais FOR ALL TO authenticated
  USING (auth_is_grupo_admin() OR auth_tem_escopo(NULL, franquia_id))
  WITH CHECK (auth_is_grupo_admin() OR auth_tem_escopo(NULL, franquia_id));

-- ------------------------------------------------------------
-- FUNÇÃO: realizado comercial por convênio na competência
-- Considera oportunidades GANHAS (valor_estimado) no mês.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.realizado_comercial(p_competencia text)
RETURNS TABLE(convenio_id uuid, vendas bigint, valor numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT convenio_id,
         count(*) AS vendas,
         coalesce(sum(valor_estimado), 0) AS valor
  FROM oportunidades
  WHERE etapa = 'ganha'
    AND to_char(updated_at, 'YYYY-MM') = p_competencia
    AND convenio_id IS NOT NULL
  GROUP BY convenio_id;
$$;
GRANT EXECUTE ON FUNCTION public.realizado_comercial(text) TO authenticated;
