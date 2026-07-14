-- ============================================================
-- CONSIGTEC — CRM: TAREFAS / follow-ups da Agenda (ligáveis a lead/oportunidade/
-- cliente), com lembrete diário por e-mail. Escopo por empresa. Após 0069.
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES empresas(id),
  titulo text NOT NULL,
  descricao text,
  tipo text NOT NULL DEFAULT 'follow_up',   -- follow_up | ligacao | whatsapp | reuniao | outro
  prioridade text NOT NULL DEFAULT 'media',  -- alta | media | baixa
  status text NOT NULL DEFAULT 'aberta',     -- aberta | concluida | cancelada
  vencimento timestamptz,
  responsavel_id uuid REFERENCES usuarios(id),
  criado_por uuid REFERENCES usuarios(id),
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  oportunidade_id uuid REFERENCES oportunidades(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES clientes(id) ON DELETE SET NULL,
  concluida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tarefas_empresa ON tarefas (empresa_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_responsavel ON tarefas (responsavel_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_status_venc ON tarefas (status, vencimento);

DROP TRIGGER IF EXISTS trg_tarefas_empresa ON tarefas;
CREATE TRIGGER trg_tarefas_empresa BEFORE INSERT ON tarefas FOR EACH ROW EXECUTE FUNCTION set_empresa_do_autor();
DROP TRIGGER IF EXISTS trg_tarefas_updated ON tarefas;
CREATE TRIGGER trg_tarefas_updated BEFORE UPDATE ON tarefas FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE tarefas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tarefas_rls ON tarefas;
CREATE POLICY tarefas_rls ON tarefas FOR ALL TO authenticated
  USING (auth_is_superadmin() OR responsavel_id = auth.uid() OR criado_por = auth.uid() OR empresa_id = auth_empresa_id())
  WITH CHECK (auth_is_superadmin() OR responsavel_id = auth.uid() OR criado_por = auth.uid() OR empresa_id = auth_empresa_id());

-- ---- Lembrete diário: um e-mail por responsável com tarefas vencendo hoje/atrasadas ----
CREATE OR REPLACE FUNCTION public.lembrete_tarefas_diario()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE r record; linhas text; n int;
BEGIN
  FOR r IN
    SELECT u.id, u.email, u.nome
    FROM usuarios u
    WHERE u.ativo AND u.email IS NOT NULL AND EXISTS (
      SELECT 1 FROM tarefas t
      WHERE t.responsavel_id = u.id AND t.status = 'aberta'
        AND t.vencimento IS NOT NULL AND t.vencimento < (current_date + 1))
  LOOP
    -- não duplica no mesmo dia
    IF EXISTS (SELECT 1 FROM notificacoes WHERE evento = 'lembrete_tarefas' AND registro_ref = r.id::text AND created_at::date = current_date) THEN
      CONTINUE;
    END IF;
    SELECT string_agg(
             format('<li>%s — <b>%s</b>%s</li>',
                    to_char(t.vencimento, 'DD/MM HH24:MI'), t.titulo,
                    CASE WHEN t.vencimento < now() THEN ' <span style="color:#c0392b">(atrasada)</span>' ELSE '' END),
             '' ORDER BY t.vencimento),
           count(*)
      INTO linhas, n
    FROM tarefas t
    WHERE t.responsavel_id = r.id AND t.status = 'aberta'
      AND t.vencimento IS NOT NULL AND t.vencimento < (current_date + 1);

    IF linhas IS NULL THEN CONTINUE; END IF;
    PERFORM fn_enqueue_notif(
      'lembrete_tarefas', r.id::text,
      format('CONSIGTEC — %s tarefa(s) para hoje', n),
      format('<p>Olá, %s.</p><p>Você tem tarefas pendentes:</p><ul>%s</ul><p>Acesse o CRM → Agenda para agir.</p>', coalesce(r.nome, ''), linhas),
      ARRAY[r.email]);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.lembrete_tarefas_diario() TO authenticated;

-- Cron diário às 08:00 (a fila é despachada pelo cron de notificações existente).
SELECT cron.schedule('consigtec-lembrete-tarefas', '0 11 * * *', $$ SELECT public.lembrete_tarefas_diario(); $$)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'consigtec-lembrete-tarefas');
