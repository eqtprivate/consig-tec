-- ============================================================
-- CONSIGTEC — Chamados, Pendências e Colaboração Auditável (threads).
-- Comunicação interna ANCORADA a um registro, append-only, timeline única
-- (humano + eventos de sistema), validação de encerramento, RLS herdada da
-- fundação (auth_can_access) + participantes. Notificações via fila
-- (fn_enqueue_notif). Após 0041. Idempotente.
-- Nomes de enum com prefixo para não colidir com status_chamado/tipo_chamado.
-- ============================================================

DO $$ BEGIN CREATE TYPE thread_tipo AS ENUM ('chamado','pendencia'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE thread_status AS ENUM
  ('aberto','em_triagem','em_tratamento','aguardando_informacao','aguardando_validacao',
   'resolvido','reaberto','cancelado','encerrado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE mensagem_tipo AS ENUM ('humana','sistema'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE thread_categoria AS ENUM
  ('cadastro_tomador','vinculo_funcional','convenio_entidade','averbacao','ccb_formalizacao',
   'recebivel_pmt','comissoes','cessao_fidc','acesso_permissao','lgpd_privacidade','outro');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------
-- THREAD: chamado ou pendência, SEMPRE ancorado a um registro.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo thread_tipo NOT NULL,
  categoria thread_categoria,
  titulo text NOT NULL,
  descricao text,
  entidade_ref text NOT NULL,                 -- 'ccbs' | 'convenios' | 'contratos' | ...
  registro_id  text NOT NULL,                 -- id do registro ancorado
  empresa_id  uuid REFERENCES empresas(id),
  franquia_id uuid REFERENCES franquias(id),
  area_id     uuid NOT NULL REFERENCES areas(id),
  solicitante_id uuid NOT NULL REFERENCES usuarios(id) DEFAULT auth.uid(),
  responsavel_id uuid REFERENCES usuarios(id),
  prioridade prioridade_pendencia NOT NULL DEFAULT 'media',
  status thread_status NOT NULL DEFAULT 'aberto',
  prazo_sla timestamptz,
  requer_validacao boolean NOT NULL DEFAULT false,
  impacto text[],
  sla_notificado_em timestamptz,
  aberto_em    timestamptz NOT NULL DEFAULT now(),
  encerrado_em timestamptz,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_threads_ancora ON threads (entidade_ref, registro_id);
CREATE INDEX IF NOT EXISTS idx_threads_status ON threads (status, responsavel_id);

-- ------------------------------------------------------------
-- MENSAGENS: append-only; humanas e de sistema na mesma timeline.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mensagens (
  id bigserial PRIMARY KEY,
  thread_id uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  tipo mensagem_tipo NOT NULL DEFAULT 'humana',
  autor_id uuid REFERENCES usuarios(id) DEFAULT auth.uid(),
  corpo text NOT NULL,
  evento jsonb,
  mencoes uuid[] DEFAULT '{}',
  anexos jsonb DEFAULT '[]'::jsonb,
  deletado_em timestamptz,
  deletado_por uuid REFERENCES usuarios(id),
  motivo_delecao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mensagens_thread ON mensagens (thread_id, created_at);

CREATE TABLE IF NOT EXISTS thread_participantes (
  thread_id uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES usuarios(id),
  adicionado_por uuid REFERENCES usuarios(id),
  adicionado_em timestamptz NOT NULL DEFAULT now(),
  ultima_leitura timestamptz,
  PRIMARY KEY (thread_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS validacoes_thread (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  validador_id uuid NOT NULL REFERENCES usuarios(id) DEFAULT auth.uid(),
  aprovado boolean NOT NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 3.1 Mensagens imutáveis (append-only): bloqueia DELETE e edição de conteúdo.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mensagens_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Mensagens não podem ser excluídas. Use soft delete (deletado_em).';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF new.corpo IS DISTINCT FROM old.corpo OR new.autor_id IS DISTINCT FROM old.autor_id
       OR new.created_at IS DISTINCT FROM old.created_at OR new.tipo IS DISTINCT FROM old.tipo THEN
      RAISE EXCEPTION 'Mensagens são append-only: conteúdo, autor, tipo e data não podem ser alterados.';
    END IF;
  END IF;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_mensagens_append_only ON mensagens;
CREATE TRIGGER trg_mensagens_append_only BEFORE UPDATE OR DELETE ON mensagens
  FOR EACH ROW EXECUTE FUNCTION mensagens_append_only();

-- ------------------------------------------------------------
-- 3.2 Toda mudança relevante em thread vira mensagem de sistema + auditoria.
-- SECURITY DEFINER: injeta mensagem 'sistema' (a RLS de insert exige 'humana').
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.thread_evento_sistema()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_emails text[];
BEGIN
  IF new.status IS DISTINCT FROM old.status THEN
    INSERT INTO mensagens (thread_id, tipo, corpo, evento)
    VALUES (new.id, 'sistema', format('Status: %s → %s', old.status, new.status),
            jsonb_build_object('campo','status','de',old.status,'para',new.status));
  END IF;
  IF new.responsavel_id IS DISTINCT FROM old.responsavel_id THEN
    INSERT INTO mensagens (thread_id, tipo, corpo, evento)
    VALUES (new.id, 'sistema', 'Responsável alterado',
            jsonb_build_object('campo','responsavel','de',old.responsavel_id,'para',new.responsavel_id));
    SELECT array_agg(email) INTO v_emails FROM usuarios WHERE id = new.responsavel_id AND email IS NOT NULL;
    PERFORM fn_enqueue_notif('thread.atribuida', new.id::text,
      'Chamado atribuído a você: ' || new.titulo,
      '<p>Um chamado interno foi atribuído a você.</p><p><b>' || COALESCE(new.titulo,'') || '</b></p>', v_emails);
  END IF;
  IF new.status IS DISTINCT FROM old.status OR new.responsavel_id IS DISTINCT FROM old.responsavel_id
     OR new.prioridade IS DISTINCT FROM old.prioridade THEN
    INSERT INTO auditoria (entidade, registro_id, acao, usuario_id, valor_antigo, valor_novo)
    VALUES ('threads', new.id::text, TG_OP, auth.uid(), to_jsonb(old), to_jsonb(new));
  END IF;
  new.updated_at = now();
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_thread_evento ON threads;
CREATE TRIGGER trg_thread_evento BEFORE UPDATE ON threads
  FOR EACH ROW EXECUTE FUNCTION thread_evento_sistema();

-- ------------------------------------------------------------
-- 3.3 Não encerrar dado crítico sem validação aprovada.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.thread_exige_validacao()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF new.status IN ('resolvido','encerrado') AND new.requer_validacao
     AND NOT EXISTS (SELECT 1 FROM validacoes_thread v WHERE v.thread_id = new.id AND v.aprovado) THEN
    RAISE EXCEPTION 'Chamado de dado crítico exige validação aprovada antes do encerramento.';
  END IF;
  IF new.status IN ('resolvido','encerrado') AND new.encerrado_em IS NULL THEN
    new.encerrado_em = now();
  END IF;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_thread_validacao ON threads;
CREATE TRIGGER trg_thread_validacao BEFORE UPDATE ON threads
  FOR EACH ROW EXECUTE FUNCTION thread_exige_validacao();

-- ------------------------------------------------------------
-- Nova mensagem humana: "toca" a thread e notifica responsável/solicitante/menções.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mensagem_nova_humana()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_emails text[]; v_titulo text;
BEGIN
  UPDATE threads SET updated_at = now() WHERE id = NEW.thread_id;
  SELECT array_agg(DISTINCT u.email), max(t.titulo) INTO v_emails, v_titulo
  FROM usuarios u
  JOIN threads t ON t.id = NEW.thread_id
  WHERE u.email IS NOT NULL AND u.id <> COALESCE(NEW.autor_id, '00000000-0000-0000-0000-000000000000')
    AND (u.id = t.responsavel_id OR u.id = t.solicitante_id OR u.id = ANY(NEW.mencoes));
  PERFORM fn_enqueue_notif('thread.mensagem_nova', NEW.thread_id::text,
    'Nova mensagem: ' || COALESCE(v_titulo, 'chamado'),
    '<p>Há uma nova mensagem em um chamado interno.</p><p>' || left(NEW.corpo, 400) || '</p>', v_emails);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_mensagem_nova ON mensagens;
CREATE TRIGGER trg_mensagem_nova AFTER INSERT ON mensagens
  FOR EACH ROW WHEN (NEW.tipo = 'humana') EXECUTE FUNCTION mensagem_nova_humana();

-- ------------------------------------------------------------
-- 4. RLS — herda auth_can_access(empresa, franquia, area) + participantes.
-- ------------------------------------------------------------
ALTER TABLE threads              ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens            ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE validacoes_thread    ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.auth_pode_ver_thread(p_thread uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM threads t
    WHERE t.id = p_thread AND (
      auth_can_access(t.empresa_id, t.franquia_id, t.area_id)
      OR t.solicitante_id = auth.uid()
      OR t.responsavel_id = auth.uid()
      OR EXISTS (SELECT 1 FROM thread_participantes p WHERE p.thread_id = t.id AND p.usuario_id = auth.uid())
    )
  );
$$;
GRANT EXECUTE ON FUNCTION public.auth_pode_ver_thread(uuid) TO authenticated;

DROP POLICY IF EXISTS threads_rls ON threads;
CREATE POLICY threads_rls ON threads FOR ALL TO authenticated
  USING (auth_pode_ver_thread(id))
  WITH CHECK (auth_can_access(empresa_id, franquia_id, area_id) OR solicitante_id = auth.uid());

DROP POLICY IF EXISTS mensagens_read ON mensagens;
CREATE POLICY mensagens_read ON mensagens FOR SELECT TO authenticated
  USING (auth_pode_ver_thread(thread_id));
DROP POLICY IF EXISTS mensagens_insert ON mensagens;
CREATE POLICY mensagens_insert ON mensagens FOR INSERT TO authenticated
  WITH CHECK (auth_pode_ver_thread(thread_id) AND autor_id = auth.uid() AND tipo = 'humana');
DROP POLICY IF EXISTS mensagens_update ON mensagens;   -- soft delete próprio
CREATE POLICY mensagens_update ON mensagens FOR UPDATE TO authenticated
  USING (auth_pode_ver_thread(thread_id));

DROP POLICY IF EXISTS participantes_rls ON thread_participantes;
CREATE POLICY participantes_rls ON thread_participantes FOR ALL TO authenticated
  USING (auth_pode_ver_thread(thread_id)) WITH CHECK (auth_pode_ver_thread(thread_id));
DROP POLICY IF EXISTS validacoes_rls ON validacoes_thread;
CREATE POLICY validacoes_rls ON validacoes_thread FOR ALL TO authenticated
  USING (auth_pode_ver_thread(thread_id)) WITH CHECK (auth_pode_ver_thread(thread_id));

-- ------------------------------------------------------------
-- Abertura de thread (app ou eventos de sistema).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.abrir_thread(
  p_tipo thread_tipo, p_categoria thread_categoria, p_titulo text, p_descricao text,
  p_entidade_ref text, p_registro_id text, p_area uuid,
  p_empresa uuid DEFAULT NULL, p_franquia uuid DEFAULT NULL, p_solicitante uuid DEFAULT NULL,
  p_responsavel uuid DEFAULT NULL, p_prioridade prioridade_pendencia DEFAULT 'media',
  p_requer_validacao boolean DEFAULT false, p_prazo_sla timestamptz DEFAULT NULL)
RETURNS threads LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v threads;
BEGIN
  INSERT INTO threads (tipo, categoria, titulo, descricao, entidade_ref, registro_id, area_id,
                       empresa_id, franquia_id, solicitante_id, responsavel_id, prioridade,
                       requer_validacao, prazo_sla)
  VALUES (p_tipo, p_categoria, p_titulo, p_descricao, p_entidade_ref, p_registro_id, p_area,
          p_empresa, p_franquia, COALESCE(p_solicitante, auth.uid(), p_responsavel),
          p_responsavel, p_prioridade, p_requer_validacao, p_prazo_sla)
  RETURNING * INTO v;
  RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.abrir_thread(thread_tipo, thread_categoria, text, text, text, text, uuid, uuid, uuid, uuid, uuid, prioridade_pendencia, boolean, timestamptz) TO authenticated;

-- ------------------------------------------------------------
-- SLA: marca threads vencidas, notifica responsável (job pg_cron diário).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.varrer_sla_threads()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE r record; v_emails text[]; v_cnt int := 0;
BEGIN
  FOR r IN
    SELECT * FROM threads
     WHERE prazo_sla IS NOT NULL AND prazo_sla < now()
       AND status NOT IN ('resolvido','encerrado','cancelado')
       AND sla_notificado_em IS NULL
  LOOP
    SELECT array_agg(email) INTO v_emails FROM usuarios WHERE id = r.responsavel_id AND email IS NOT NULL;
    PERFORM fn_enqueue_notif('thread.sla_vencido', r.id::text,
      'SLA vencido: ' || r.titulo,
      '<p>O SLA do chamado <b>' || COALESCE(r.titulo,'') || '</b> venceu.</p>',
      COALESCE(v_emails, fn_admin_emails()));
    UPDATE threads SET sla_notificado_em = now() WHERE id = r.id;
    v_cnt := v_cnt + 1;
  END LOOP;
  RETURN v_cnt;
END $$;
GRANT EXECUTE ON FUNCTION public.varrer_sla_threads() TO authenticated;

DO $$ BEGIN PERFORM cron.unschedule('consigtec-sla-threads'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('consigtec-sla-threads', '0 9 * * *', $$ SELECT public.varrer_sla_threads(); $$);
