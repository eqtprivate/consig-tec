-- ============================================================
-- CONSIGTEC — Configuração editável do full sync PixConsig + status.
-- Dá à tela de Integrações:
--   * configurar_sync_pixconsig(intervalo, hora_ini, hora_fim, ativo) — regrava
--     o job pg_cron a partir de uma janela em BRT (converte p/ UTC) e persiste
--     a preferência em configuracoes['sync_pixconsig'].
--   * status_sync_pixconsig() — devolve config atual, estado do cron, tamanho do
--     espelho e as últimas execuções (auditoria) para o painel/percentual.
-- Ambos SECURITY DEFINER, restritos a admin. Após 0047. Idempotente.
-- BRT = UTC-3 (sem horário de verão).
-- ============================================================

-- ------------------------------------------------------------
-- Regrava o agendamento a partir de uma janela comercial (horas em BRT).
-- Ex.: (4, 9, 17, true) -> roda 09:00/13:00/17:00 BRT = 12,16,20 UTC.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.configurar_sync_pixconsig(
  p_intervalo int,
  p_hora_inicio int,
  p_hora_fim int,
  p_ativo boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_hours_brt int[];
  v_hours_utc int[];
  v_cron text;
  v_cfg jsonb;
BEGIN
  IF NOT auth_is_grupo_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem configurar a sincronização.';
  END IF;
  IF p_intervalo < 1 OR p_intervalo > 24 THEN
    RAISE EXCEPTION 'Intervalo deve estar entre 1 e 24 horas.';
  END IF;
  IF p_hora_inicio < 0 OR p_hora_inicio > 23 OR p_hora_fim < 0 OR p_hora_fim > 23 THEN
    RAISE EXCEPTION 'Horas devem estar entre 0 e 23.';
  END IF;
  IF p_hora_fim < p_hora_inicio THEN
    RAISE EXCEPTION 'A hora final deve ser maior ou igual à inicial.';
  END IF;

  -- horas BRT dentro da janela, de p_intervalo em p_intervalo
  SELECT array_agg(h ORDER BY h) INTO v_hours_brt
  FROM generate_series(p_hora_inicio, p_hora_fim, p_intervalo) AS h;

  -- BRT (UTC-3) -> UTC
  SELECT array_agg(DISTINCT ((h + 3) % 24) ORDER BY ((h + 3) % 24)) INTO v_hours_utc
  FROM unnest(v_hours_brt) AS h;

  v_cron := '0 ' || array_to_string(v_hours_utc, ',') || ' * * *';

  -- (re)agenda no pg_cron
  BEGIN PERFORM cron.unschedule('consigtec-sync-pixconsig'); EXCEPTION WHEN OTHERS THEN NULL; END;
  IF p_ativo THEN
    PERFORM cron.schedule('consigtec-sync-pixconsig', v_cron,
      $q$ SELECT public.disparar_sync_pixconsig(); $q$);
  END IF;

  v_cfg := jsonb_build_object(
    'intervalo_horas', p_intervalo,
    'hora_inicio', p_hora_inicio,
    'hora_fim', p_hora_fim,
    'ativo', p_ativo,
    'horarios_brt', to_jsonb(v_hours_brt),
    'cron_utc', v_cron
  );
  INSERT INTO configuracoes (chave, valor, descricao)
  VALUES ('sync_pixconsig', v_cfg, 'Janela e intervalo do full sync PixConsig (horas em BRT).')
  ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, descricao = EXCLUDED.descricao;

  RETURN v_cfg;
END $$;
GRANT EXECUTE ON FUNCTION public.configurar_sync_pixconsig(int, int, int, boolean) TO authenticated;

-- ------------------------------------------------------------
-- Painel: config + cron + tamanho do espelho + últimas execuções.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.status_sync_pixconsig()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_cfg jsonb;
  v_cron jsonb;
  v_esp jsonb;
  v_exec jsonb;
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

  RETURN jsonb_build_object('config', v_cfg, 'cron', v_cron, 'espelho', v_esp, 'execucoes', v_exec);
END $$;
GRANT EXECUTE ON FUNCTION public.status_sync_pixconsig() TO authenticated;
