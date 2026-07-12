-- ============================================================
-- CONSIGTEC — Automação agendada (pg_cron).
--   Job diário: atualizar_carteira() — marca atrasos, ajusta status dos
--   contratos e gera cobranças de inadimplência sem intervenção manual.
-- O disparo da fila de notificações fica documentado no fim (precisa de
-- pg_net + URL/secret da função de envio). Após 0037. Idempotente.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove agendamento anterior (se houver) para reescrever de forma idempotente.
DO $$ BEGIN
  PERFORM cron.unschedule('consigtec-atualizar-carteira');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Todos os dias às 06:00 UTC (~03:00 BRT).
SELECT cron.schedule(
  'consigtec-atualizar-carteira',
  '0 6 * * *',
  $$ SELECT public.atualizar_carteira(); $$
);

-- ------------------------------------------------------------
-- (OPCIONAL) Disparo agendado da FILA DE NOTIFICAÇÕES.
-- Requer: extensão pg_net + a URL da função de envio (dispatchNotificacao)
-- + o token de serviço guardado no Vault. Ative preenchendo os valores e
-- removendo os comentários. Roda a cada 5 min e chama o endpoint que lê as
-- notificações 'pendente' e envia via Resend.
-- ------------------------------------------------------------
-- CREATE EXTENSION IF NOT EXISTS pg_net;
--
-- -- Guarde o token uma vez (não versione o segredo):
-- --   SELECT vault.create_secret('SEU_SERVICE_TOKEN', 'consigtec_dispatch_token');
--
-- DO $$ BEGIN
--   PERFORM cron.unschedule('consigtec-dispatch-notificacoes');
-- EXCEPTION WHEN OTHERS THEN NULL; END $$;
--
-- SELECT cron.schedule(
--   'consigtec-dispatch-notificacoes',
--   '*/5 * * * *',
--   $$
--   SELECT net.http_post(
--     url     := 'https://SEU_ENDPOINT/dispatchNotificacao',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'consigtec_dispatch_token')
--     ),
--     body    := '{}'::jsonb
--   );
--   $$
-- );

-- Conferir os jobs agendados:
--   SELECT jobid, jobname, schedule, active FROM cron.job;
-- Ver execuções recentes:
--   SELECT jobid, status, return_message, start_time FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
