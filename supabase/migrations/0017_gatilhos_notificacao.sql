-- ============================================================
-- CONSIGTEC — Estágio 9 (automação): gatilhos de notificação
-- Triggers no Postgres que ENFILEIRAM notificações em eventos-chave.
-- O envio em si segue pelo dispatchNotificacao (Resend). SECURITY
-- DEFINER para inserir na fila mesmo quando quem dispara o evento não
-- é admin. Aplicar após 0016. Idempotente.
-- ============================================================

-- E-mails dos admins ativos do grupo (destinatários padrão)
CREATE OR REPLACE FUNCTION public.fn_admin_emails()
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT array_agg(email) FROM usuarios
  WHERE role IN ('admin','superadmin') AND ativo IS TRUE AND email IS NOT NULL;
$$;

-- Enfileira uma notificação na tabela `notificacoes`
CREATE OR REPLACE FUNCTION public.fn_enqueue_notif(
  p_evento text, p_ref text, p_assunto text, p_corpo text, p_emails text[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF p_emails IS NULL OR array_length(p_emails, 1) IS NULL THEN RETURN; END IF;
  INSERT INTO notificacoes (evento, registro_ref, destinatarios, canal, assunto, corpo, status_envio)
  VALUES (p_evento, p_ref, to_jsonb(p_emails), 'email', p_assunto, p_corpo, 'pendente');
END;
$$;

-- ---------------- Pendência crítica ----------------
CREATE OR REPLACE FUNCTION public.trg_notif_pendencia()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE emails text[]; resp text;
BEGIN
  IF NEW.prioridade = 'critica'
     AND (TG_OP = 'INSERT' OR OLD.prioridade IS DISTINCT FROM NEW.prioridade) THEN
    emails := fn_admin_emails();
    SELECT email INTO resp FROM usuarios WHERE id = NEW.responsavel_id;
    IF resp IS NOT NULL THEN emails := array_append(emails, resp); END IF;
    PERFORM fn_enqueue_notif(
      'pendencia_critica', NEW.id::text,
      'Pendência crítica: ' || COALESCE(NEW.titulo, '(sem título)'),
      '<p>Uma pendência <b>crítica</b> foi registrada no CONSIGTEC.</p>' ||
      '<p>' || COALESCE(NEW.descricao, '') || '</p>', emails);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notif_pendencia ON pendencias;
CREATE TRIGGER trg_notif_pendencia AFTER INSERT OR UPDATE ON pendencias
  FOR EACH ROW EXECUTE FUNCTION trg_notif_pendencia();

-- ---------------- Proposta aprovada/reprovada ----------------
CREATE OR REPLACE FUNCTION public.trg_notif_proposta()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NEW.status IN ('aprovada','reprovada') AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM fn_enqueue_notif(
      'proposta_' || NEW.status, NEW.id::text,
      'Proposta ' || NEW.status,
      '<p>A proposta <code>' || NEW.id || '</code> mudou para <b>' || NEW.status || '</b>.</p>',
      fn_admin_emails());
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notif_proposta ON propostas;
CREATE TRIGGER trg_notif_proposta AFTER UPDATE ON propostas
  FOR EACH ROW EXECUTE FUNCTION trg_notif_proposta();

-- ---------------- Nova cobrança (falha de repasse etc.) ----------------
CREATE OR REPLACE FUNCTION public.trg_notif_cobranca()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  PERFORM fn_enqueue_notif(
    'cobranca_' || NEW.gatilho, NEW.id::text,
    'Nova cobrança: ' || NEW.gatilho,
    '<p>Registrada uma cobrança por <b>' || NEW.gatilho || '</b> no valor de R$ ' ||
    COALESCE(NEW.valor::text, '0') || '.</p>', fn_admin_emails());
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notif_cobranca ON cobrancas;
CREATE TRIGGER trg_notif_cobranca AFTER INSERT ON cobrancas
  FOR EACH ROW EXECUTE FUNCTION trg_notif_cobranca();
