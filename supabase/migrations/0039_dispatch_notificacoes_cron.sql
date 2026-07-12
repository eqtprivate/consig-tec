-- ============================================================
-- CONSIGTEC — Envio automático da fila de notificações (Resend via pg_net).
-- Lê `notificacoes` pendentes (canal e-mail) e envia direto pela API do
-- Resend, sem depender de função externa. Agendado a cada 5 min por pg_cron.
-- Segredos no Vault: 'resend_api_key' e (opcional) 'resend_from'.
-- Após 0038. Idempotente.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Colunas de controle de envio (idempotente).
ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS enviado_em timestamptz;
ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS erro_envio text;

-- ------------------------------------------------------------
-- Envia as notificações pendentes. Marca 'enviado' de forma otimista
-- (a confirmação da API fica em net._http_response para auditoria).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dispatch_notificacoes_pendentes(p_limite int DEFAULT 50)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_key  text;
  v_from text;
  r      record;
  v_cnt  int := 0;
BEGIN
  SELECT decrypted_secret INTO v_key  FROM vault.decrypted_secrets WHERE name = 'resend_api_key' LIMIT 1;
  SELECT decrypted_secret INTO v_from FROM vault.decrypted_secrets WHERE name = 'resend_from' LIMIT 1;
  IF v_key IS NULL THEN
    RAISE NOTICE 'Vault sem resend_api_key — nada enviado.';
    RETURN 0;
  END IF;
  v_from := COALESCE(v_from, 'CONSIGTEC <no-reply@consigtec.com.br>');

  FOR r IN
    SELECT * FROM notificacoes
     WHERE status_envio = 'pendente' AND canal = 'email'
       AND destinatarios IS NOT NULL AND jsonb_array_length(destinatarios) > 0
     ORDER BY created_at
     LIMIT GREATEST(p_limite, 1)
  LOOP
    PERFORM net.http_post(
      url     := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
      body    := jsonb_build_object(
                   'from', v_from,
                   'to', r.destinatarios,
                   'subject', COALESCE(r.assunto, 'CONSIGTEC'),
                   'html', COALESCE(r.corpo, '')
                 )
    );
    UPDATE notificacoes SET status_envio = 'enviado', enviado_em = now(), erro_envio = NULL WHERE id = r.id;
    v_cnt := v_cnt + 1;
  END LOOP;

  RETURN v_cnt;
END;
$$;

-- Gatilho manual para admin (botão "Enviar pendentes agora").
CREATE OR REPLACE FUNCTION public.dispatch_notificacoes_admin()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NOT auth_is_grupo_admin() THEN
    RAISE EXCEPTION 'Apenas administradores do grupo podem disparar o envio.';
  END IF;
  RETURN dispatch_notificacoes_pendentes();
END;
$$;
GRANT EXECUTE ON FUNCTION public.dispatch_notificacoes_admin() TO authenticated;

-- Agenda: a cada 5 minutos.
DO $$ BEGIN
  PERFORM cron.unschedule('consigtec-dispatch-notificacoes');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'consigtec-dispatch-notificacoes',
  '*/5 * * * *',
  $$ SELECT public.dispatch_notificacoes_pendentes(); $$
);
