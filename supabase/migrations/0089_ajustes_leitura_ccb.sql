-- ============================================================
-- CONSIGTEC — Ajustes da leitura de CCB (por empresa) + log de tentativas.
-- 1) config_ingestao_ccb: modelo + limite de confiança POR EMPRESA, lido pela
--    Edge Function ingerir_ccb (fallback: secret CLAUDE_MODEL → claude-sonnet-5).
-- 2) ingestao_tentativas: log append-only de cada leitura (modelo, tokens,
--    custo estimado em US$, duração, confiança, resultado, erro).
-- 3) salvar_config_ingestao_ccb(): upsert autorizado (admin/superadmin),
--    resolvendo a empresa efetiva (superadmin pode focar via p_empresa).
-- Também acrescenta ingestoes_documento.modelo_usado. Idempotente.
-- ============================================================

-- 1) Config por empresa ---------------------------------------------------
CREATE TABLE IF NOT EXISTS config_ingestao_ccb (
  empresa_id       uuid PRIMARY KEY REFERENCES empresas(id) ON DELETE CASCADE,
  modelo           text NOT NULL DEFAULT 'claude-sonnet-5',
  confianca_minima numeric(5,4) NOT NULL DEFAULT 0.7500
                     CHECK (confianca_minima >= 0 AND confianca_minima <= 1),
  atualizado_por   uuid,
  atualizado_em    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE config_ingestao_ccb ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cfg_ingestao_rls ON config_ingestao_ccb;
CREATE POLICY cfg_ingestao_rls ON config_ingestao_ccb FOR ALL TO authenticated
  USING (auth_is_superadmin() OR empresa_id = auth_empresa_id())
  WITH CHECK (auth_is_superadmin() OR (auth_is_empresa_admin() AND empresa_id = auth_empresa_id()));

-- 2) Log de tentativas (append-only) -------------------------------------
CREATE TABLE IF NOT EXISTS ingestao_tentativas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid REFERENCES empresas(id) ON DELETE CASCADE,
  ingestao_id     uuid REFERENCES ingestoes_documento(id) ON DELETE SET NULL,
  arquivo_nome    text,
  modelo          text,
  status          text NOT NULL DEFAULT 'ok',      -- ok | erro | duplicado
  tokens_entrada  int,
  tokens_saida    int,
  custo_usd       numeric(12,6),
  duracao_ms      int,
  confianca       numeric(5,4),
  revisao_forcada boolean NOT NULL DEFAULT false,   -- confiança < limite
  reprocessamento boolean NOT NULL DEFAULT false,
  erro            text,
  criado_por      uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tentativas_empresa ON ingestao_tentativas (empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tentativas_ingestao ON ingestao_tentativas (ingestao_id);
ALTER TABLE ingestao_tentativas ENABLE ROW LEVEL SECURITY;
-- Leitura por empresa; escrita só pelo backend (service_role bypassa RLS).
DROP POLICY IF EXISTS tentativas_read ON ingestao_tentativas;
CREATE POLICY tentativas_read ON ingestao_tentativas FOR SELECT TO authenticated
  USING (auth_is_superadmin() OR empresa_id = auth_empresa_id());

-- 3) Modelo usado na última leitura (para a tela de conferência) ----------
ALTER TABLE ingestoes_documento ADD COLUMN IF NOT EXISTS modelo_usado text;

-- 4) RPC de gravação da config (upsert autorizado) -----------------------
CREATE OR REPLACE FUNCTION public.salvar_config_ingestao_ccb(
  p_modelo text, p_confianca numeric DEFAULT NULL, p_empresa uuid DEFAULT NULL
) RETURNS config_ingestao_ccb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE emp uuid; linha config_ingestao_ccb;
BEGIN
  emp := auth_empresa_efetiva(p_empresa);
  IF emp IS NULL THEN RAISE EXCEPTION 'Empresa não resolvida (selecione uma empresa).'; END IF;
  IF NOT auth_is_empresa_admin() THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
  IF p_modelo NOT IN ('claude-haiku-4-5','claude-sonnet-5','claude-opus-4-8') THEN
    RAISE EXCEPTION 'Modelo inválido: %', p_modelo;
  END IF;
  INSERT INTO config_ingestao_ccb (empresa_id, modelo, confianca_minima, atualizado_por, atualizado_em)
  VALUES (emp, p_modelo, COALESCE(p_confianca, 0.7500), auth.uid(), now())
  ON CONFLICT (empresa_id) DO UPDATE
    SET modelo = EXCLUDED.modelo,
        confianca_minima = EXCLUDED.confianca_minima,
        atualizado_por = auth.uid(),
        atualizado_em = now()
  RETURNING * INTO linha;
  RETURN linha;
END; $$;
GRANT EXECUTE ON FUNCTION public.salvar_config_ingestao_ccb(text, numeric, uuid) TO authenticated;
