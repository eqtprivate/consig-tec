-- ============================================================
-- CONSIGTEC — BPO Fase 4: BPOPrévia (cartão). Prévia mensal dos descontos a
-- processar nos portais: cria/importa a prévia, marca envio, captura o resultado
-- e trata as CRÍTICAS automaticamente (reprocessa pela margem disponível, acima
-- do valor mínimo). Após 0074. Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS previas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES empresas(id),
  convenio_id uuid REFERENCES convenios(id),
  competencia text NOT NULL,               -- 'YYYY-MM'
  arquivo_nome text,
  total_itens int NOT NULL DEFAULT 0,
  total_valor numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'rascunho',  -- rascunho | enviada | processada
  enviada_em timestamptz,
  processada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS previa_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  previa_id uuid NOT NULL REFERENCES previas(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES empresas(id),
  cpf text,
  matricula text,
  valor_a_descontar numeric(12,2) NOT NULL DEFAULT 0,
  margem_disponivel numeric(12,2),
  valor_efetivo numeric(12,2),
  status text NOT NULL DEFAULT 'pendente',  -- pendente | processado | critica | reprocessar
  motivo_critica text
);

CREATE INDEX IF NOT EXISTS idx_previas_empresa ON previas (empresa_id);
CREATE INDEX IF NOT EXISTS idx_previa_itens_previa ON previa_itens (previa_id);

DROP TRIGGER IF EXISTS trg_previas_empresa ON previas;
CREATE TRIGGER trg_previas_empresa BEFORE INSERT ON previas FOR EACH ROW EXECUTE FUNCTION set_empresa_do_autor();
DROP TRIGGER IF EXISTS trg_previa_itens_empresa ON previa_itens;
CREATE TRIGGER trg_previa_itens_empresa BEFORE INSERT ON previa_itens FOR EACH ROW EXECUTE FUNCTION set_empresa_do_autor();
DROP TRIGGER IF EXISTS trg_previas_updated ON previas;
CREATE TRIGGER trg_previas_updated BEFORE UPDATE ON previas FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE previas ENABLE ROW LEVEL SECURITY;
ALTER TABLE previa_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS previas_rls ON previas;
CREATE POLICY previas_rls ON previas FOR ALL TO authenticated
  USING (auth_is_superadmin() OR empresa_id = auth_empresa_id())
  WITH CHECK (auth_is_superadmin() OR empresa_id = auth_empresa_id());
DROP POLICY IF EXISTS previa_itens_rls ON previa_itens;
CREATE POLICY previa_itens_rls ON previa_itens FOR ALL TO authenticated
  USING (auth_is_superadmin() OR empresa_id = auth_empresa_id())
  WITH CHECK (auth_is_superadmin() OR empresa_id = auth_empresa_id());

-- Tratamento automático de críticas: itens sem margem cheia mas com margem
-- disponível >= valor mínimo são reprocessados pelo valor possível (least).
CREATE OR REPLACE FUNCTION public.tratar_criticas_previa(p_previa uuid, p_valor_minimo numeric DEFAULT 0)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_emp uuid; v_cnt int;
BEGIN
  SELECT empresa_id INTO v_emp FROM previas WHERE id = p_previa;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'Prévia não encontrada.'; END IF;
  IF NOT (auth_is_superadmin() OR v_emp = auth_empresa_id()) THEN
    RAISE EXCEPTION 'Fora do escopo da sua empresa.';
  END IF;

  UPDATE previa_itens
     SET valor_efetivo = least(valor_a_descontar, margem_disponivel),
         status = 'reprocessar'
   WHERE previa_id = p_previa AND status = 'critica'
     AND margem_disponivel IS NOT NULL AND margem_disponivel >= coalesce(p_valor_minimo, 0)
     AND margem_disponivel > 0;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  RETURN v_cnt;
END $$;
GRANT EXECUTE ON FUNCTION public.tratar_criticas_previa(uuid, numeric) TO authenticated;

-- Captura do resultado do processamento: aplica status/margem/motivo por CPF.
-- p_itens: [{ "cpf": "...", "status": "processado|critica", "margem": 0, "motivo": "..." }]
CREATE OR REPLACE FUNCTION public.importar_resultado_previa(p_previa uuid, p_itens jsonb)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_emp uuid; v_cnt int;
BEGIN
  SELECT empresa_id INTO v_emp FROM previas WHERE id = p_previa;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'Prévia não encontrada.'; END IF;
  IF NOT (auth_is_superadmin() OR v_emp = auth_empresa_id()) THEN
    RAISE EXCEPTION 'Fora do escopo da sua empresa.';
  END IF;

  UPDATE previa_itens pi
     SET status = coalesce(nullif(src.j->>'status', ''), 'processado'),
         margem_disponivel = nullif(src.j->>'margem', '')::numeric,
         motivo_critica = nullif(src.j->>'motivo', ''),
         valor_efetivo = CASE WHEN coalesce(src.j->>'status', 'processado') = 'processado'
                              THEN pi.valor_a_descontar ELSE pi.valor_efetivo END
  FROM (
    SELECT regexp_replace(x->>'cpf', '\D', '', 'g') AS cpf, x AS j
    FROM jsonb_array_elements(p_itens) x
  ) src
  WHERE pi.previa_id = p_previa
    AND regexp_replace(pi.cpf, '\D', '', 'g') = src.cpf;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;

  UPDATE previas SET status = 'processada', processada_em = now() WHERE id = p_previa;
  RETURN v_cnt;
END $$;
GRANT EXECUTE ON FUNCTION public.importar_resultado_previa(uuid, jsonb) TO authenticated;
