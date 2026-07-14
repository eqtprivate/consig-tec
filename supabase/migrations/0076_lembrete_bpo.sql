-- ============================================================
-- CONSIGTEC — BPO Fase 5: datas de processamento + NOTIFICAÇÃO. Nos dias
-- parametrizados na averbadora (dia_previa / dia_retorno), notifica os admins da
-- empresa para enviar a prévia / capturar o retorno. Usa a fila de notificações
-- (Resend) já existente. Após 0075. Idempotente.
-- ============================================================

CREATE OR REPLACE FUNCTION public.lembrete_bpo_diario()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE a record; v_dia int; v_emails text[]; v_conv text; v_evt text; v_ref text;
BEGIN
  v_dia := extract(day FROM current_date)::int;

  FOR a IN
    SELECT * FROM averbadoras
    WHERE ativo AND (dia_previa = v_dia OR dia_retorno = v_dia)
  LOOP
    -- admins da empresa da averbadora
    SELECT array_agg(email) INTO v_emails FROM usuarios
     WHERE empresa_id = a.empresa_id AND ativo AND email IS NOT NULL AND role IN ('admin', 'superadmin');
    IF v_emails IS NULL THEN CONTINUE; END IF;

    -- convênios da averbadora
    SELECT string_agg(nome, ', ') INTO v_conv FROM convenios WHERE averbadora_id = a.id;

    IF a.dia_previa = v_dia THEN
      v_evt := 'bpo_previa'; v_ref := a.id::text || ':previa';
      IF NOT EXISTS (SELECT 1 FROM notificacoes WHERE evento = v_evt AND registro_ref = v_ref AND created_at::date = current_date) THEN
        PERFORM fn_enqueue_notif(v_evt, v_ref,
          format('CONSIGTEC — enviar PRÉVIA (%s)', a.nome),
          format('<p>Hoje é o dia de envio da <b>prévia</b> na averbadora <b>%s</b>.</p><p>Convênios: %s</p>', a.nome, coalesce(v_conv, '—')),
          v_emails);
      END IF;
    END IF;

    IF a.dia_retorno = v_dia THEN
      v_evt := 'bpo_retorno'; v_ref := a.id::text || ':retorno';
      IF NOT EXISTS (SELECT 1 FROM notificacoes WHERE evento = v_evt AND registro_ref = v_ref AND created_at::date = current_date) THEN
        PERFORM fn_enqueue_notif(v_evt, v_ref,
          format('CONSIGTEC — capturar RETORNO (%s)', a.nome),
          format('<p>Hoje é o dia de disponibilização do <b>arquivo de retorno</b> na averbadora <b>%s</b>.</p><p>Convênios: %s</p>', a.nome, coalesce(v_conv, '—')),
          v_emails);
      END IF;
    END IF;
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.lembrete_bpo_diario() TO authenticated;

SELECT cron.schedule('consigtec-lembrete-bpo', '0 11 * * *', $$ SELECT public.lembrete_bpo_diario(); $$)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'consigtec-lembrete-bpo');
