-- ============================================================
-- CONSIGTEC — status_sync_pixconsig() passa a devolver a RECONCILIAÇÃO de
-- volume (espelho x total informado pela API) para exibir no painel de sync.
-- Lê da auditoria a última execução que tenha total_api (backend v1.19.0+).
-- Após 0048. Idempotente (CREATE OR REPLACE).
-- ============================================================

CREATE OR REPLACE FUNCTION public.status_sync_pixconsig()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_cfg jsonb;
  v_cron jsonb;
  v_esp jsonb;
  v_exec jsonb;
  v_recon jsonb;
BEGIN
  IF NOT auth_is_grupo_admin() THEN
    RAISE EXCEPTION 'Sem permissão.';
  END IF;

  SELECT valor INTO v_cfg FROM configuracoes WHERE chave = 'sync_pixconsig';
  IF v_cfg IS NULL THEN
    v_cfg := jsonb_build_object('intervalo_horas', 4, 'hora_inicio', 9, 'hora_fim', 17,
                                'ativo', true, 'horarios_brt', jsonb_build_array(9, 13, 17));
  END IF;

  SELECT jsonb_build_object('schedule', schedule, 'active', active)
  INTO v_cron FROM cron.job WHERE jobname = 'consigtec-sync-pixconsig';

  SELECT jsonb_build_object(
    'convenios', count(*) FILTER (WHERE origem_dado = 'pixconsig'),
    'convenios_total', count(*),
    'ultima_sync', max(ultima_sincronizacao)
  ) INTO v_esp FROM convenios;

  SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC), '[]'::jsonb) INTO v_exec
  FROM (
    SELECT created_at, acao,
           (valor_novo->>'total')::int      AS total,
           (valor_novo->>'ok')::int         AS ok,
           (valor_novo->>'ignorados')::int  AS ignorados,
           (valor_novo->>'erros')::int      AS erros
    FROM auditoria
    WHERE acao IN ('sync_pixconsig', 'sync_pixconsig_manual')
    ORDER BY created_at DESC
    LIMIT 8
  ) e;

  -- Reconciliação: última execução que reportou total_api (backend v1.19.0+).
  SELECT jsonb_build_object(
    'total_api', (a.valor_novo->>'total_api')::int,
    'espelho', (SELECT count(*) FROM convenios WHERE origem_dado = 'pixconsig'),
    'paginas', (a.valor_novo->>'paginas')::int,
    'erros', (a.valor_novo->>'erros')::int,
    'erros_amostra', a.valor_novo->'erros_amostra',
    'quando', a.created_at
  ) INTO v_recon
  FROM auditoria a
  WHERE a.acao IN ('sync_pixconsig', 'sync_pixconsig_manual') AND (a.valor_novo->>'total_api') IS NOT NULL
  ORDER BY a.created_at DESC
  LIMIT 1;

  RETURN jsonb_build_object('config', v_cfg, 'cron', v_cron, 'espelho', v_esp,
                            'execucoes', v_exec, 'reconciliacao', v_recon);
END $$;
GRANT EXECUTE ON FUNCTION public.status_sync_pixconsig() TO authenticated;
