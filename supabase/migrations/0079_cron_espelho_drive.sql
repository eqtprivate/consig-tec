-- ============================================================
-- CONSIGTEC — Retry do espelho no Google Drive. pg_cron aciona (via pg_net) a
-- Edge Function espelhar_drive em modo lote (reprocessar), que reenvia as CCBs
-- aprovadas ainda sem drive_file_id. O espelho é best-effort e NUNCA afeta a CCB.
-- Segredos no Vault:
--   espelhar_drive_url    = URL pública da função espelhar_drive
--   ingestao_sync_token   = mesmo valor de INGESTAO_SYNC_TOKEN no backend
-- Após 0078. Idempotente. Enquanto os segredos não existirem, roda inócuo.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.disparar_espelho_drive()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_url text; v_token text;
BEGIN
  SELECT decrypted_secret INTO v_url   FROM vault.decrypted_secrets WHERE name = 'espelhar_drive_url' LIMIT 1;
  SELECT decrypted_secret INTO v_token FROM vault.decrypted_secrets WHERE name = 'ingestao_sync_token' LIMIT 1;
  IF v_url IS NULL THEN
    RAISE NOTICE 'Vault sem espelhar_drive_url — retry não disparado.';
    RETURN;
  END IF;
  -- só chama se houver pendência (evita HTTP à toa)
  IF NOT EXISTS (SELECT 1 FROM ingestoes_documento
                 WHERE status = 'aprovado' AND drive_file_id IS NULL AND storage_path IS NOT NULL) THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-token', COALESCE(v_token, '')),
    body    := jsonb_build_object('reprocessar', true)
  );
END $$;
GRANT EXECUTE ON FUNCTION public.disparar_espelho_drive() TO authenticated;

-- A cada 30 minutos.
DO $$ BEGIN PERFORM cron.unschedule('consigtec-espelho-drive'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('consigtec-espelho-drive', '*/30 * * * *', $$ SELECT public.disparar_espelho_drive(); $$);
