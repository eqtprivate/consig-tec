-- ============================================================
-- CONSIGTEC — Reagenda o full sync PixConsig para janela comercial.
-- Antes: 1x/dia às 05:00 UTC. Agora: de 4 em 4 horas, das 09:00 às 17:00 BRT
-- (último passo de 4h dentro da janela 09:00–20:00), ou seja 09:00 / 13:00 /
-- 17:00 BRT = 12:00 / 16:00 / 20:00 UTC (BRT = UTC-3, sem horário de verão).
-- Após 0046. Idempotente.
-- ============================================================

DO $$ BEGIN
  PERFORM cron.unschedule('consigtec-sync-pixconsig');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'consigtec-sync-pixconsig',
  '0 12,16,20 * * *',   -- 09:00, 13:00, 17:00 BRT
  $$ SELECT public.disparar_sync_pixconsig(); $$
);
