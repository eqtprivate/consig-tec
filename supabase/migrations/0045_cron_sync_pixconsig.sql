-- ============================================================
-- CONSIGTEC — Full sync DIÁRIO dos convênios PixConsig.
-- pg_cron aciona (via pg_net) a função backend syncPixconsig, que percorre a
-- API v1 paginada e faz upsert do espelho. Segredos no Vault:
--   pixconsig_sync_url   = URL pública da função syncPixconsig
--   pixconsig_sync_token = mesmo valor de PIXCONSIG_SYNC_TOKEN no backend
-- Após 0044. Idempotente. Enquanto os segredos não existirem, roda inócuo.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.disparar_sync_pixconsig()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_url text; v_token text;
BEGIN
  SELECT decrypted_secret INTO v_url   FROM vault.decrypted_secrets WHERE name = 'pixconsig_sync_url' LIMIT 1;
  SELECT decrypted_secret INTO v_token FROM vault.decrypted_secrets WHERE name = 'pixconsig_sync_token' LIMIT 1;
  IF v_url IS NULL THEN
    RAISE NOTICE 'Vault sem pixconsig_sync_url — sync não disparado.';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-token', COALESCE(v_token, '')),
    body    := '{}'::jsonb
  );
END $$;
GRANT EXECUTE ON FUNCTION public.disparar_sync_pixconsig() TO authenticated;

-- Diariamente às 05:00 UTC (~02:00 BRT), antes da atualização de carteira (06:00).
DO $$ BEGIN
  PERFORM cron.unschedule('consigtec-sync-pixconsig');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'consigtec-sync-pixconsig',
  '0 5 * * *',
  $$ SELECT public.disparar_sync_pixconsig(); $$
);
