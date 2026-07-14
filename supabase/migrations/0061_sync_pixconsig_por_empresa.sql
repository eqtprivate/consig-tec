-- ============================================================
-- CONSIGTEC — Multi-tenant (Fase B): painel de sync PixConsig POR EMPRESA.
-- progresso/status/novidades passam a aceitar p_empresa e filtram o espelho,
-- a reconciliação e o feed de eventos pela empresa efetiva (superadmin
-- "ver como"; admin comum só a própria). Sem p_empresa → auth_empresa_efetiva.
-- Permissão relaxada de superadmin (auth_is_grupo_admin) para admin da empresa
-- (auth_is_empresa_admin), pois cada cliente enxerga o próprio sync.
-- O backend passa a gravar progresso em sync_progresso.chave = 'pixconsig:<emp>'.
-- Após 0060. Idempotente. Recria as 3 RPCs (troca de assinatura → DROP+CREATE).
-- ============================================================

DROP FUNCTION IF EXISTS public.progresso_sync_pixconsig();
DROP FUNCTION IF EXISTS public.status_sync_pixconsig();
DROP FUNCTION IF EXISTS public.novidades_sync_pixconsig(int);

-- Progresso ao vivo da empresa (fallback p/ chave legada 'pixconsig').
CREATE OR REPLACE FUNCTION public.progresso_sync_pixconsig(p_empresa uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v jsonb; emp uuid;
BEGIN
  IF NOT auth_is_empresa_admin() THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
  emp := auth_empresa_efetiva(p_empresa);
  SELECT to_jsonb(s) INTO v FROM sync_progresso s WHERE chave = 'pixconsig:' || emp::text;
  IF v IS NULL THEN
    SELECT to_jsonb(s) INTO v FROM sync_progresso s WHERE chave = 'pixconsig';
  END IF;
  RETURN v; -- null se nunca rodou
END $$;
GRANT EXECUTE ON FUNCTION public.progresso_sync_pixconsig(uuid) TO authenticated;

-- Status/reconciliação do espelho da empresa efetiva.
CREATE OR REPLACE FUNCTION public.status_sync_pixconsig(p_empresa uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  emp uuid;
  v_cfg jsonb; v_cron jsonb; v_esp jsonb; v_exec jsonb; v_recon jsonb;
BEGIN
  IF NOT auth_is_empresa_admin() THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
  emp := auth_empresa_efetiva(p_empresa);

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
  ) INTO v_esp FROM convenios WHERE empresa_id = emp;

  SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC), '[]'::jsonb) INTO v_exec
  FROM (
    SELECT created_at, acao,
           (valor_novo->>'total')::int      AS total,
           (valor_novo->>'ok')::int         AS ok,
           (valor_novo->>'ignorados')::int  AS ignorados,
           (valor_novo->>'erros')::int      AS erros
    FROM auditoria
    WHERE acao IN ('sync_pixconsig', 'sync_pixconsig_manual') AND empresa_id = emp
    ORDER BY created_at DESC
    LIMIT 8
  ) e;

  SELECT jsonb_build_object(
    'total_api', (a.valor_novo->>'total_api')::int,
    'espelho', (SELECT count(*) FROM convenios WHERE origem_dado = 'pixconsig' AND empresa_id = emp),
    'paginas', (a.valor_novo->>'paginas')::int,
    'erros', (a.valor_novo->>'erros')::int,
    'erros_amostra', a.valor_novo->'erros_amostra',
    'quando', a.created_at
  ) INTO v_recon
  FROM auditoria a
  WHERE a.acao IN ('sync_pixconsig', 'sync_pixconsig_manual')
    AND a.empresa_id = emp AND (a.valor_novo->>'total_api') IS NOT NULL
  ORDER BY a.created_at DESC
  LIMIT 1;

  RETURN jsonb_build_object('config', v_cfg, 'cron', v_cron, 'espelho', v_esp,
                            'execucoes', v_exec, 'reconciliacao', v_recon);
END $$;
GRANT EXECUTE ON FUNCTION public.status_sync_pixconsig(uuid) TO authenticated;

-- Feed de novidades da empresa efetiva (eventos dos convênios dela).
CREATE OR REPLACE FUNCTION public.novidades_sync_pixconsig(p_limit int DEFAULT 100, p_empresa uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  emp uuid;
  v_itens jsonb; v_resumo24 jsonb; v_ultima timestamptz;
BEGIN
  IF NOT auth_is_empresa_admin() THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
  emp := auth_empresa_efetiva(p_empresa);

  SELECT max(created_at) INTO v_ultima
  FROM auditoria WHERE acao IN ('sync_pixconsig', 'sync_pixconsig_manual') AND empresa_id = emp;

  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb) INTO v_itens
  FROM (
    SELECT s.created_at, s.evento, s.mensagem, s.convenio_id, c.nome AS convenio_nome
    FROM sincronizacoes_convenio s
    JOIN convenios c ON c.id = s.convenio_id
    WHERE s.origem = 'pixconsig' AND s.evento IS NOT NULL AND c.empresa_id = emp
    ORDER BY s.created_at DESC
    LIMIT greatest(1, least(p_limit, 500))
  ) x;

  SELECT coalesce(jsonb_object_agg(evento, n), '{}'::jsonb) INTO v_resumo24
  FROM (
    SELECT s.evento, count(*) n
    FROM sincronizacoes_convenio s
    JOIN convenios c ON c.id = s.convenio_id
    WHERE s.origem = 'pixconsig' AND s.evento IS NOT NULL AND c.empresa_id = emp
      AND s.created_at >= now() - interval '24 hours'
    GROUP BY s.evento
  ) r;

  RETURN jsonb_build_object('ultima', v_ultima, 'resumo_24h', v_resumo24, 'itens', v_itens);
END $$;
GRANT EXECUTE ON FUNCTION public.novidades_sync_pixconsig(int, uuid) TO authenticated;
