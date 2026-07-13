-- ============================================================
-- CONSIGTEC — Progresso ao vivo do sync PixConsig (barra do painel).
-- O backend syncPixconsig faz UPDATE nesta linha a cada página; o painel faz
-- polling via progresso_sync_pixconsig() e move a barra 0→100 em tempo real.
-- Após 0049. Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS sync_progresso (
  chave text PRIMARY KEY,
  total int,
  processados int NOT NULL DEFAULT 0,
  pagina int NOT NULL DEFAULT 0,
  rodando boolean NOT NULL DEFAULT false,
  mensagem text,
  iniciado_em timestamptz,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sync_progresso ENABLE ROW LEVEL SECURITY;
-- Sem policy de leitura direta: acesso só via RPC SECURITY DEFINER abaixo.
-- O backend escreve com a service role (ignora RLS).

CREATE OR REPLACE FUNCTION public.progresso_sync_pixconsig()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v jsonb;
BEGIN
  IF NOT auth_is_grupo_admin() THEN
    RAISE EXCEPTION 'Sem permissão.';
  END IF;
  SELECT to_jsonb(s) INTO v FROM sync_progresso s WHERE chave = 'pixconsig';
  RETURN v; -- null se nunca rodou
END $$;
GRANT EXECUTE ON FUNCTION public.progresso_sync_pixconsig() TO authenticated;
