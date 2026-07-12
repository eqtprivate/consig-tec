-- ============================================================
-- CONSIGTEC — Chamados internos + chat entre equipes.
-- Solicitações operacionais entre usuários/áreas, com thread de mensagens.
-- Após 0040. Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- Chamado interno (solicitação operacional)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chamados_internos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  tipo text NOT NULL DEFAULT 'solicitacao',      -- solicitacao|duvida|erro_operacional|aprovacao|outro
  status text NOT NULL DEFAULT 'aberto',          -- aberto|em_andamento|aguardando|resolvido|fechado
  prioridade text NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa','media','alta','critica')),
  solicitante_id uuid REFERENCES usuarios(id) DEFAULT auth.uid(),
  responsavel_id uuid REFERENCES usuarios(id),
  destino_area_id uuid REFERENCES areas(id),
  franquia_id uuid REFERENCES franquias(id),
  ref_tipo text,                                  -- vínculo opcional (ex.: 'proposta','contrato')
  ref_id uuid,
  resolvido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ci_status ON chamados_internos(status);
CREATE INDEX IF NOT EXISTS idx_ci_responsavel ON chamados_internos(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_ci_solicitante ON chamados_internos(solicitante_id);

DROP TRIGGER IF EXISTS trg_ci_updated ON chamados_internos;
CREATE TRIGGER trg_ci_updated BEFORE UPDATE ON chamados_internos FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- Mensagens (thread / chat) do chamado
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chamados_internos_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id uuid NOT NULL REFERENCES chamados_internos(id) ON DELETE CASCADE,
  autor_id uuid REFERENCES usuarios(id) DEFAULT auth.uid(),
  corpo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cim_chamado ON chamados_internos_mensagens(chamado_id, created_at);

-- Nova mensagem "toca" o chamado (para ordenar por atividade).
CREATE OR REPLACE FUNCTION public.fn_ci_mensagem_touch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  UPDATE chamados_internos SET updated_at = now() WHERE id = NEW.chamado_id;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_cim_touch ON chamados_internos_mensagens;
CREATE TRIGGER trg_cim_touch AFTER INSERT ON chamados_internos_mensagens FOR EACH ROW EXECUTE FUNCTION fn_ci_mensagem_touch();

-- ------------------------------------------------------------
-- RLS: participantes (solicitante/responsável), admin do grupo, ou quem tem
-- escopo na franquia do chamado.
-- ------------------------------------------------------------
ALTER TABLE chamados_internos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ci_rls ON chamados_internos;
CREATE POLICY ci_rls ON chamados_internos FOR ALL TO authenticated
  USING (auth_is_grupo_admin() OR solicitante_id = auth.uid() OR responsavel_id = auth.uid() OR auth_tem_escopo(NULL, franquia_id))
  WITH CHECK (auth_is_grupo_admin() OR solicitante_id = auth.uid() OR responsavel_id = auth.uid() OR auth_tem_escopo(NULL, franquia_id));

ALTER TABLE chamados_internos_mensagens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cim_rls ON chamados_internos_mensagens;
CREATE POLICY cim_rls ON chamados_internos_mensagens FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM chamados_internos c WHERE c.id = chamado_id
      AND (auth_is_grupo_admin() OR c.solicitante_id = auth.uid() OR c.responsavel_id = auth.uid() OR auth_tem_escopo(NULL, c.franquia_id))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM chamados_internos c WHERE c.id = chamado_id
      AND (auth_is_grupo_admin() OR c.solicitante_id = auth.uid() OR c.responsavel_id = auth.uid() OR auth_tem_escopo(NULL, c.franquia_id))
  ));

-- ------------------------------------------------------------
-- Notifica o responsável quando o chamado é atribuído (integra com a fila).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_notif_chamado_interno()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_email text;
BEGIN
  IF NEW.responsavel_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id) THEN
    SELECT email INTO v_email FROM usuarios WHERE id = NEW.responsavel_id;
    IF v_email IS NOT NULL THEN
      PERFORM fn_enqueue_notif(
        'chamado_interno', NEW.id::text,
        'Chamado interno atribuído a você: ' || NEW.titulo,
        '<p>Um chamado interno foi atribuído a você no CONSIGTEC.</p><p><b>' ||
        COALESCE(NEW.titulo, '') || '</b></p><p>' || COALESCE(NEW.descricao, '') || '</p>',
        ARRAY[v_email]);
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notif_ci ON chamados_internos;
CREATE TRIGGER trg_notif_ci AFTER INSERT OR UPDATE OF responsavel_id ON chamados_internos
  FOR EACH ROW EXECUTE FUNCTION trg_notif_chamado_interno();
