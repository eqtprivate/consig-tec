-- ============================================================
-- CONSIGTEC — P0 Seguranca (Item 1): trilha de acesso do superadmin.
-- Registra quando o superadmin entra em "ver como" (impersonacao de um tenant)
-- e acoes administrativas cross-tenant. Escopo escolhido: impersonacao + acoes
-- (nao intercepta cada SELECT — Postgres nao tem trigger de leitura).
-- So superadmin LE a trilha; a gravacao e via RPC SECURITY DEFINER.
-- Apos 0080. Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS logs_acesso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ator_id uuid REFERENCES usuarios(id),
  ator_email text,
  evento text NOT NULL,                 -- 'impersonacao_inicio' | 'impersonacao_fim' | 'acao_admin'
  empresa_alvo uuid REFERENCES empresas(id),
  detalhe jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_logs_acesso_ator  ON logs_acesso (ator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_acesso_alvo  ON logs_acesso (empresa_alvo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_acesso_event ON logs_acesso (evento, created_at DESC);

ALTER TABLE logs_acesso ENABLE ROW LEVEL SECURITY;
-- Leitura so para superadmin (e uma trilha sensivel). Sem policy de INSERT/UPDATE/
-- DELETE: ninguem grava direto — so o RPC SECURITY DEFINER abaixo.
DROP POLICY IF EXISTS logs_acesso_read ON logs_acesso;
CREATE POLICY logs_acesso_read ON logs_acesso FOR SELECT TO authenticated
  USING (auth_is_superadmin());

-- Registro append-only. SECURITY DEFINER: grava mesmo sem policy de INSERT.
-- Carimba ator_id/email do JWT — o cliente nao escolhe quem e o ator.
CREATE OR REPLACE FUNCTION public.registrar_log_acesso(
  p_evento text,
  p_empresa_alvo uuid DEFAULT NULL,
  p_detalhe jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_id uuid; v_email text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT email INTO v_email FROM usuarios WHERE id = auth.uid();
  INSERT INTO logs_acesso (ator_id, ator_email, evento, empresa_alvo, detalhe)
  VALUES (auth.uid(), v_email, coalesce(nullif(btrim(p_evento), ''), 'evento'),
          p_empresa_alvo, coalesce(p_detalhe, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.registrar_log_acesso(text, uuid, jsonb) TO authenticated;
