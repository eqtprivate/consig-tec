-- ============================================================
-- CONSIGTEC — Alerta automático de meta comercial (pg_cron).
-- Função que enfileira alerta dos municípios prioritários abaixo do
-- ritmo, agendada semanalmente. Após 0022. Idempotente.
-- ============================================================

CREATE OR REPLACE FUNCTION public.alertas_meta_comercial()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE comp text; ritmo numeric; linhas text; emails text[]; n int;
BEGIN
  comp := to_char(current_date, 'YYYY-MM');
  ritmo := extract(day FROM current_date)::numeric
         / extract(day FROM (date_trunc('month', current_date) + interval '1 month' - interval '1 day'))::numeric;

  SELECT string_agg(
           format('<li><b>%s</b> (%s): %s/%s vendas</li>', c.nome, c.prioridade_comercial, COALESCE(r.vendas, 0), mc.meta_vendas),
           ''),
         count(*)
    INTO linhas, n
  FROM convenios c
  JOIN metas_comerciais mc ON mc.convenio_id = c.id AND mc.competencia = comp AND COALESCE(mc.meta_vendas, 0) > 0
  LEFT JOIN realizado_comercial(comp) r ON r.convenio_id = c.id
  WHERE c.prioridade_comercial IN ('alta', 'media')
    AND COALESCE(r.vendas, 0) < mc.meta_vendas * ritmo * 0.8;

  IF linhas IS NULL THEN RETURN; END IF;
  -- não duplica no mesmo dia
  IF EXISTS (SELECT 1 FROM notificacoes WHERE evento = 'alerta_meta_comercial' AND created_at::date = current_date) THEN RETURN; END IF;

  emails := fn_admin_emails();
  PERFORM fn_enqueue_notif(
    'alerta_meta_comercial', comp,
    format('CONSIGTEC — %s município(s) abaixo da meta (%s)', n, comp),
    format('<p>Municípios prioritários abaixo do ritmo da meta em %s:</p><ul>%s</ul>', comp, linhas),
    emails);
END;
$$;
GRANT EXECUTE ON FUNCTION public.alertas_meta_comercial() TO authenticated;

-- Agendamento semanal (segundas 12:00). Requer pg_cron habilitado.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  BEGIN PERFORM cron.unschedule('consigtec_alerta_meta'); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM cron.schedule('consigtec_alerta_meta', '0 12 * * 1', 'SELECT public.alertas_meta_comercial()');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron indisponível — habilite em Database > Extensions e agende manualmente. Detalhe: %', SQLERRM;
END $$;
