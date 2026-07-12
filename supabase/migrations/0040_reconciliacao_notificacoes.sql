-- ============================================================
-- CONSIGTEC — Reconciliação do envio de notificações.
-- Guarda o id da requisição pg_net ao enviar e, depois, confere a resposta
-- real do Resend (net._http_response): 2xx confirma; ≠2xx volta para 'erro'
-- com a mensagem em erro_envio. Após 0039. Idempotente.
-- ============================================================

ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS http_request_id bigint;
ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS reconciliado_em timestamptz;

-- Regera o dispatcher guardando o request_id da chamada pg_net.
CREATE OR REPLACE FUNCTION public.dispatch_notificacoes_pendentes(p_limite int DEFAULT 50)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_key  text;
  v_from text;
  r      record;
  v_req  bigint;
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
    v_req := net.http_post(
      url     := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
      body    := jsonb_build_object(
                   'from', v_from,
                   'to', r.destinatarios,
                   'subject', COALESCE(r.assunto, 'CONSIGTEC'),
                   'html', COALESCE(r.corpo, '')
                 )
    );
    UPDATE notificacoes
       SET status_envio = 'enviado', enviado_em = now(), erro_envio = NULL,
           http_request_id = v_req, reconciliado_em = NULL
     WHERE id = r.id;
    v_cnt := v_cnt + 1;
  END LOOP;

  RETURN v_cnt;
END;
$$;

-- Reconcilia com a resposta real do Resend.
CREATE OR REPLACE FUNCTION public.reconciliar_notificacoes()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE r record; v_cnt int := 0;
BEGIN
  FOR r IN
    SELECT n.id, resp.status_code, resp.content, resp.error_msg
    FROM notificacoes n
    JOIN net._http_response resp ON resp.id = n.http_request_id
    WHERE n.http_request_id IS NOT NULL AND n.reconciliado_em IS NULL
  LOOP
    IF r.status_code BETWEEN 200 AND 299 THEN
      UPDATE notificacoes SET reconciliado_em = now(), erro_envio = NULL WHERE id = r.id;
    ELSE
      UPDATE notificacoes
         SET status_envio = 'erro',
             erro_envio = COALESCE(r.error_msg, 'HTTP ' || COALESCE(r.status_code::text, '?') || ': ' || left(COALESCE(r.content, ''), 300)),
             reconciliado_em = now()
       WHERE id = r.id;
    END IF;
    v_cnt := v_cnt + 1;
  END LOOP;
  RETURN v_cnt;
END;
$$;
GRANT EXECUTE ON FUNCTION public.reconciliar_notificacoes() TO authenticated;

-- Agenda a reconciliação (defasada 2 min do envio para a resposta já existir).
DO $$ BEGIN
  PERFORM cron.unschedule('consigtec-reconciliar-notificacoes');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'consigtec-reconciliar-notificacoes',
  '2-59/5 * * * *',
  $$ SELECT public.reconciliar_notificacoes(); $$
);
