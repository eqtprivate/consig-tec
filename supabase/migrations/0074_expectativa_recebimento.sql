-- ============================================================
-- CONSIGTEC — BPO Fase 3: EXPECTATIVA DE RECEBIMENTO formal. A expectativa
-- (contratos/descontos esperados na competência) passa a ser um dataset:
-- GERADA das parcelas OU IMPORTADA do banco (API/FTP/upload). A conciliação
-- usa a expectativa materializada (auto-gera das parcelas se não houver).
-- Após 0073. Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS expectativas_recebimento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES empresas(id),
  convenio_id uuid REFERENCES convenios(id) ON DELETE CASCADE,
  competencia text NOT NULL,               -- 'YYYY-MM'
  cpf text,
  cliente_id uuid REFERENCES clientes(id),
  contrato_id uuid REFERENCES contratos(id),
  valor_esperado numeric(12,2) NOT NULL DEFAULT 0,
  origem text NOT NULL DEFAULT 'gerada',    -- gerada | importada
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_exp_chave ON expectativas_recebimento (empresa_id, convenio_id, competencia);
DROP TRIGGER IF EXISTS trg_exp_empresa ON expectativas_recebimento;
CREATE TRIGGER trg_exp_empresa BEFORE INSERT ON expectativas_recebimento FOR EACH ROW EXECUTE FUNCTION set_empresa_do_autor();

ALTER TABLE expectativas_recebimento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS exp_rls ON expectativas_recebimento;
CREATE POLICY exp_rls ON expectativas_recebimento FOR ALL TO authenticated
  USING (auth_is_superadmin() OR empresa_id = auth_empresa_id())
  WITH CHECK (auth_is_superadmin() OR empresa_id = auth_empresa_id());

-- Gera a expectativa da competência a partir das parcelas abertas do convênio.
CREATE OR REPLACE FUNCTION public.gerar_expectativa(p_convenio uuid, p_competencia text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_emp uuid; v_cnt int;
BEGIN
  SELECT empresa_id INTO v_emp FROM convenios WHERE id = p_convenio;
  IF NOT (auth_is_superadmin() OR v_emp = auth_empresa_id()) THEN
    RAISE EXCEPTION 'Fora do escopo da sua empresa.';
  END IF;

  DELETE FROM expectativas_recebimento WHERE convenio_id = p_convenio AND competencia = p_competencia AND empresa_id = v_emp;

  INSERT INTO expectativas_recebimento (empresa_id, convenio_id, competencia, cpf, cliente_id, contrato_id, valor_esperado, origem)
  SELECT v_emp, p_convenio, p_competencia, regexp_replace(cl.cpf, '\D', '', 'g'), cl.id, min(ct.id), sum(p.valor), 'gerada'
  FROM parcelas p
  JOIN contratos ct ON ct.id = p.contrato_id
  JOIN clientes cl ON cl.id = ct.cliente_id
  WHERE ct.convenio_id = p_convenio AND ct.empresa_id = v_emp
    AND to_char(p.vencimento, 'YYYY-MM') = p_competencia
    AND p.status IN ('aberta', 'atrasada') AND cl.cpf IS NOT NULL
  GROUP BY regexp_replace(cl.cpf, '\D', '', 'g'), cl.id;

  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  RETURN v_cnt;
END $$;
GRANT EXECUTE ON FUNCTION public.gerar_expectativa(uuid, text) TO authenticated;

-- conciliar_retorno passa a usar a expectativa materializada (auto-gera se vazia).
CREATE OR REPLACE FUNCTION public.conciliar_retorno(p_retorno uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE r retornos_folha; v_resumo jsonb; v_tem int;
BEGIN
  SELECT * INTO r FROM retornos_folha WHERE id = p_retorno;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Retorno não encontrado.'; END IF;
  IF NOT (auth_is_superadmin() OR r.empresa_id = auth_empresa_id()) THEN
    RAISE EXCEPTION 'Fora do escopo da sua empresa.';
  END IF;

  -- garante expectativa materializada (gera das parcelas se ainda não existe)
  SELECT count(*) INTO v_tem FROM expectativas_recebimento
   WHERE empresa_id = r.empresa_id AND convenio_id = r.convenio_id AND competencia = r.competencia;
  IF v_tem = 0 THEN PERFORM gerar_expectativa(r.convenio_id, r.competencia); END IF;

  DELETE FROM conciliacao_ocorrencias WHERE retorno_id = p_retorno;

  WITH exp AS (
    SELECT regexp_replace(cpf, '\D', '', 'g') AS cpf, min(cliente_id) AS cliente_id,
           min(contrato_id) AS contrato_id, sum(valor_esperado) AS esperado
    FROM expectativas_recebimento
    WHERE empresa_id = r.empresa_id AND convenio_id = r.convenio_id AND competencia = r.competencia AND cpf IS NOT NULL
    GROUP BY regexp_replace(cpf, '\D', '', 'g')
  ),
  ret AS (
    SELECT regexp_replace(cpf, '\D', '', 'g') AS cpf, sum(valor_descontado) AS descontado, max(motivo) AS motivo
    FROM retorno_itens WHERE retorno_id = p_retorno AND cpf IS NOT NULL
    GROUP BY regexp_replace(cpf, '\D', '', 'g')
  ),
  uni AS (
    SELECT coalesce(e.cpf, x.cpf) AS cpf, e.cliente_id, e.contrato_id,
           coalesce(e.esperado, 0) AS esperado, coalesce(x.descontado, 0) AS descontado, x.motivo
    FROM exp e FULL OUTER JOIN ret x ON x.cpf = e.cpf
  )
  INSERT INTO conciliacao_ocorrencias
    (empresa_id, retorno_id, convenio_id, competencia, cpf, cliente_id, contrato_id, tipo,
     valor_esperado, valor_descontado, diferenca, motivo, status)
  SELECT r.empresa_id, p_retorno, r.convenio_id, r.competencia, u.cpf, u.cliente_id, u.contrato_id,
    CASE WHEN u.esperado > 0 AND u.descontado = 0 THEN 'sem_desconto'
         WHEN u.esperado = 0 AND u.descontado > 0 THEN 'sem_contrato'
         WHEN u.descontado + 0.01 < u.esperado THEN 'parcial'
         ELSE 'ok' END,
    u.esperado, u.descontado, round(u.descontado - u.esperado, 2), u.motivo,
    CASE WHEN (u.esperado > 0 AND u.descontado = 0) OR (u.esperado = 0 AND u.descontado > 0)
           OR (u.descontado + 0.01 < u.esperado) THEN 'aberta' ELSE 'tratada' END
  FROM uni u;

  UPDATE retornos_folha SET status = 'conciliado', conciliado_em = now() WHERE id = p_retorno;
  PERFORM recalcular_financeiro_retorno(p_retorno);

  SELECT jsonb_object_agg(tipo, n) INTO v_resumo
  FROM (SELECT tipo, count(*) n FROM conciliacao_ocorrencias WHERE retorno_id = p_retorno GROUP BY tipo) t;
  RETURN coalesce(v_resumo, '{}'::jsonb);
END $$;
GRANT EXECUTE ON FUNCTION public.conciliar_retorno(uuid) TO authenticated;
