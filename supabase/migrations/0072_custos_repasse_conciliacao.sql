-- ============================================================
-- CONSIGTEC — BPO Fase 1: CUSTOS DE PROCESSAMENTO por convênio + REPASSE LÍQUIDO
-- a partir da conciliação. Custos: por_linha, percentual, ted, fixo — abatidos do
-- valor conciliado para compor o valor líquido a repassar. Recalcula o resumo
-- financeiro do retorno na conciliação e gera/atualiza o repasse. Após 0071.
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS custos_processamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES empresas(id),
  convenio_id uuid REFERENCES convenios(id) ON DELETE CASCADE,
  tipo text NOT NULL,                       -- por_linha | percentual | ted | fixo
  valor numeric(12,4) NOT NULL DEFAULT 0,   -- percentual em %; demais em R$
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_custos_convenio ON custos_processamento (convenio_id);
CREATE INDEX IF NOT EXISTS idx_custos_empresa ON custos_processamento (empresa_id);
DROP TRIGGER IF EXISTS trg_custos_empresa ON custos_processamento;
CREATE TRIGGER trg_custos_empresa BEFORE INSERT ON custos_processamento FOR EACH ROW EXECUTE FUNCTION set_empresa_do_autor();
DROP TRIGGER IF EXISTS trg_custos_updated ON custos_processamento;
CREATE TRIGGER trg_custos_updated BEFORE UPDATE ON custos_processamento FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE custos_processamento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS custos_rls ON custos_processamento;
CREATE POLICY custos_rls ON custos_processamento FOR ALL TO authenticated
  USING (auth_is_superadmin() OR empresa_id = auth_empresa_id())
  WITH CHECK (auth_is_superadmin() OR empresa_id = auth_empresa_id());

-- Resumo financeiro no cabeçalho do retorno.
ALTER TABLE retornos_folha ADD COLUMN IF NOT EXISTS valor_conciliado numeric(14,2);
ALTER TABLE retornos_folha ADD COLUMN IF NOT EXISTS custo_total numeric(14,2);
ALTER TABLE retornos_folha ADD COLUMN IF NOT EXISTS valor_liquido numeric(14,2);

-- Recalcula os custos e o líquido de um retorno já conciliado.
CREATE OR REPLACE FUNCTION public.recalcular_financeiro_retorno(p_retorno uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE r retornos_folha; v_conc numeric; v_itens int; v_custo numeric;
BEGIN
  SELECT * INTO r FROM retornos_folha WHERE id = p_retorno;
  IF r.id IS NULL THEN RETURN; END IF;

  SELECT coalesce(sum(valor_descontado), 0), count(*) FILTER (WHERE valor_descontado > 0)
    INTO v_conc, v_itens
  FROM conciliacao_ocorrencias WHERE retorno_id = p_retorno AND tipo IN ('ok', 'parcial');

  SELECT coalesce(sum(valor) FILTER (WHERE tipo = 'por_linha'), 0) * v_itens
       + coalesce(sum(valor) FILTER (WHERE tipo = 'percentual'), 0) / 100 * v_conc
       + coalesce(sum(valor) FILTER (WHERE tipo = 'ted'), 0)
       + coalesce(sum(valor) FILTER (WHERE tipo = 'fixo'), 0)
    INTO v_custo
  FROM custos_processamento
  WHERE convenio_id = r.convenio_id AND empresa_id = r.empresa_id AND ativo;

  UPDATE retornos_folha
     SET valor_conciliado = round(v_conc, 2),
         custo_total = round(coalesce(v_custo, 0), 2),
         valor_liquido = round(v_conc - coalesce(v_custo, 0), 2)
   WHERE id = p_retorno;
END $$;
GRANT EXECUTE ON FUNCTION public.recalcular_financeiro_retorno(uuid) TO authenticated;

-- Gera/atualiza o repasse (repasses_folha) a partir do líquido conciliado.
CREATE OR REPLACE FUNCTION public.gerar_repasse_da_conciliacao(p_retorno uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE r retornos_folha; v_id uuid;
BEGIN
  SELECT * INTO r FROM retornos_folha WHERE id = p_retorno;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Retorno não encontrado.'; END IF;
  IF NOT (auth_is_superadmin() OR r.empresa_id = auth_empresa_id()) THEN
    RAISE EXCEPTION 'Fora do escopo da sua empresa.';
  END IF;
  PERFORM recalcular_financeiro_retorno(p_retorno);
  SELECT valor_liquido INTO r.valor_liquido FROM retornos_folha WHERE id = p_retorno;

  SELECT id INTO v_id FROM repasses_folha
   WHERE empresa_id = r.empresa_id AND convenio_id = r.convenio_id
     AND competencia = r.competencia AND franquia_id IS NULL
   LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO repasses_folha (empresa_id, convenio_id, competencia, valor_previsto, status, arquivo_cnab, observacao)
    VALUES (r.empresa_id, r.convenio_id, r.competencia, r.valor_liquido, 'pendente', r.arquivo_nome,
            'Gerado da conciliação de folha')
    RETURNING id INTO v_id;
  ELSE
    UPDATE repasses_folha
       SET valor_previsto = r.valor_liquido, arquivo_cnab = coalesce(arquivo_cnab, r.arquivo_nome),
           observacao = 'Atualizado pela conciliação de folha', updated_at = now()
     WHERE id = v_id;
  END IF;
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.gerar_repasse_da_conciliacao(uuid) TO authenticated;

-- conciliar_retorno passa a recalcular o financeiro ao final.
CREATE OR REPLACE FUNCTION public.conciliar_retorno(p_retorno uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE r retornos_folha; v_resumo jsonb;
BEGIN
  SELECT * INTO r FROM retornos_folha WHERE id = p_retorno;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Retorno não encontrado.'; END IF;
  IF NOT (auth_is_superadmin() OR r.empresa_id = auth_empresa_id()) THEN
    RAISE EXCEPTION 'Fora do escopo da sua empresa.';
  END IF;

  DELETE FROM conciliacao_ocorrencias WHERE retorno_id = p_retorno;

  WITH exp AS (
    SELECT regexp_replace(cl.cpf, '\D', '', 'g') AS cpf, cl.id AS cliente_id,
           min(ct.id) AS contrato_id, sum(p.valor) AS esperado
    FROM parcelas p
    JOIN contratos ct ON ct.id = p.contrato_id
    JOIN clientes cl ON cl.id = ct.cliente_id
    WHERE ct.convenio_id = r.convenio_id AND ct.empresa_id = r.empresa_id
      AND to_char(p.vencimento, 'YYYY-MM') = r.competencia
      AND p.status IN ('aberta', 'atrasada') AND cl.cpf IS NOT NULL
    GROUP BY regexp_replace(cl.cpf, '\D', '', 'g'), cl.id
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
