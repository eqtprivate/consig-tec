-- ============================================================
-- CONSIGTEC — Reconciliação de logs_acesso.
-- A tabela real em produção tem (usuario_id, acao, entidade, registro_id, ip),
-- mas o 0081 no repo descrevia (ator_id, ator_email, evento, empresa_alvo,
-- detalhe) e a função registrar_log_acesso inseria nessas colunas — por isso a
-- trilha de impersonação ("ver como") FALHAVA silenciosamente (o front chama em
-- try/catch). Aqui: (1) garantimos as colunas necessárias de forma ADITIVA
-- (no-op onde já existem — funciona tanto sobre o schema real quanto sobre o do
-- 0081), e (2) recriamos registrar_log_acesso para gravar nas colunas reais,
-- mantendo a MESMA assinatura usada pelo frontend. Após 0096. Idempotente.
-- ============================================================

-- (1) Superset de colunas — não destrói nada; só adiciona o que faltar.
ALTER TABLE public.logs_acesso
  ADD COLUMN IF NOT EXISTS usuario_id  uuid REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS acao        text,
  ADD COLUMN IF NOT EXISTS entidade    text,
  ADD COLUMN IF NOT EXISTS registro_id text,
  ADD COLUMN IF NOT EXISTS detalhe     jsonb NOT NULL DEFAULT '{}'::jsonb;

-- (2) Grava a trilha nas colunas reais. Mesma assinatura
-- (p_evento, p_empresa_alvo, p_detalhe) — o frontend não muda.
-- SECURITY DEFINER: escreve mesmo sem policy de INSERT. Carimba usuario_id do JWT.
CREATE OR REPLACE FUNCTION public.registrar_log_acesso(
  p_evento text,
  p_empresa_alvo uuid DEFAULT NULL,
  p_detalhe jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  INSERT INTO logs_acesso (usuario_id, acao, entidade, registro_id, detalhe)
  VALUES (
    auth.uid(),
    coalesce(nullif(btrim(p_evento), ''), 'evento'),
    'empresas',
    p_empresa_alvo::text,
    coalesce(p_detalhe, '{}'::jsonb)
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.registrar_log_acesso(text, uuid, jsonb) TO authenticated;
