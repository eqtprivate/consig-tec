-- ============================================================
-- CONSIGTEC — Feed de novidades da sincronização PixConsig.
-- O backend syncPixconsig grava eventos em sincronizacoes_convenio
-- (evento = nova_prefeitura | mudanca_status | ativada | decreto_enviado |
--  mudanca_capag). Esta RPC alimenta a "janela de avisos" do painel.
-- Após 0050. Idempotente.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_sinc_evento ON sincronizacoes_convenio (evento, created_at DESC)
  WHERE evento IS NOT NULL;

CREATE OR REPLACE FUNCTION public.novidades_sync_pixconsig(p_limit int DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_itens jsonb;
  v_resumo24 jsonb;
  v_ultima timestamptz;
BEGIN
  IF NOT auth_is_grupo_admin() THEN
    RAISE EXCEPTION 'Sem permissão.';
  END IF;

  -- momento da última execução de sync
  SELECT max(created_at) INTO v_ultima
  FROM auditoria WHERE acao IN ('sync_pixconsig', 'sync_pixconsig_manual');

  -- itens recentes (com nome do convênio quando existir)
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb) INTO v_itens
  FROM (
    SELECT s.created_at, s.evento, s.mensagem, s.convenio_id, c.nome AS convenio_nome
    FROM sincronizacoes_convenio s
    LEFT JOIN convenios c ON c.id = s.convenio_id
    WHERE s.origem = 'pixconsig' AND s.evento IS NOT NULL
    ORDER BY s.created_at DESC
    LIMIT greatest(1, least(p_limit, 500))
  ) x;

  -- resumo das últimas 24h por tipo de evento
  SELECT coalesce(jsonb_object_agg(evento, n), '{}'::jsonb) INTO v_resumo24
  FROM (
    SELECT evento, count(*) n
    FROM sincronizacoes_convenio
    WHERE origem = 'pixconsig' AND evento IS NOT NULL AND created_at >= now() - interval '24 hours'
    GROUP BY evento
  ) r;

  RETURN jsonb_build_object('ultima', v_ultima, 'resumo_24h', v_resumo24, 'itens', v_itens);
END $$;
GRANT EXECUTE ON FUNCTION public.novidades_sync_pixconsig(int) TO authenticated;
