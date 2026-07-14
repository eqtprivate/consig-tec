-- ============================================================
-- CONSIGTEC — Conciliação de folha (BPORetorno-like). Concilia o ARQUIVO DE
-- RETORNO da averbadora (descontos em folha) contra a EXPECTATIVA de recebimento
-- (parcelas abertas na competência do convênio), CONTRATO/PARCELA a contrato,
-- gerando ocorrências: ok | parcial | sem_desconto (inadimplência) |
-- sem_contrato (devolução). Escopo por empresa. Após 0070. Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS retornos_folha (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES empresas(id),
  convenio_id uuid REFERENCES convenios(id),
  competencia text NOT NULL,                 -- 'YYYY-MM'
  arquivo_nome text,
  total_itens int NOT NULL DEFAULT 0,
  total_valor numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'importado',  -- importado | conciliado
  conciliado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS retorno_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retorno_id uuid NOT NULL REFERENCES retornos_folha(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES empresas(id),
  cpf text,
  matricula text,
  valor_descontado numeric(12,2) NOT NULL DEFAULT 0,
  motivo text
);

CREATE TABLE IF NOT EXISTS conciliacao_ocorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES empresas(id),
  retorno_id uuid REFERENCES retornos_folha(id) ON DELETE CASCADE,
  convenio_id uuid REFERENCES convenios(id),
  competencia text,
  cpf text,
  cliente_id uuid REFERENCES clientes(id),
  contrato_id uuid REFERENCES contratos(id),
  tipo text NOT NULL,                        -- ok | parcial | sem_desconto | sem_contrato
  valor_esperado numeric(12,2) NOT NULL DEFAULT 0,
  valor_descontado numeric(12,2) NOT NULL DEFAULT 0,
  diferenca numeric(12,2) NOT NULL DEFAULT 0,
  motivo text,
  status text NOT NULL DEFAULT 'aberta',     -- aberta | tratada | ignorada
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retornos_empresa ON retornos_folha (empresa_id);
CREATE INDEX IF NOT EXISTS idx_retorno_itens_ret ON retorno_itens (retorno_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_ret ON conciliacao_ocorrencias (retorno_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_empresa ON conciliacao_ocorrencias (empresa_id, tipo, status);

-- carimbo de empresa no insert (autor)
DROP TRIGGER IF EXISTS trg_retornos_empresa ON retornos_folha;
CREATE TRIGGER trg_retornos_empresa BEFORE INSERT ON retornos_folha FOR EACH ROW EXECUTE FUNCTION set_empresa_do_autor();
DROP TRIGGER IF EXISTS trg_retorno_itens_empresa ON retorno_itens;
CREATE TRIGGER trg_retorno_itens_empresa BEFORE INSERT ON retorno_itens FOR EACH ROW EXECUTE FUNCTION set_empresa_do_autor();
DROP TRIGGER IF EXISTS trg_retornos_updated ON retornos_folha;
CREATE TRIGGER trg_retornos_updated BEFORE UPDATE ON retornos_folha FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE retornos_folha ENABLE ROW LEVEL SECURITY;
ALTER TABLE retorno_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE conciliacao_ocorrencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS retornos_rls ON retornos_folha;
CREATE POLICY retornos_rls ON retornos_folha FOR ALL TO authenticated
  USING (auth_is_superadmin() OR empresa_id = auth_empresa_id())
  WITH CHECK (auth_is_superadmin() OR empresa_id = auth_empresa_id());
DROP POLICY IF EXISTS retorno_itens_rls ON retorno_itens;
CREATE POLICY retorno_itens_rls ON retorno_itens FOR ALL TO authenticated
  USING (auth_is_superadmin() OR empresa_id = auth_empresa_id())
  WITH CHECK (auth_is_superadmin() OR empresa_id = auth_empresa_id());
DROP POLICY IF EXISTS ocorrencias_rls ON conciliacao_ocorrencias;
CREATE POLICY ocorrencias_rls ON conciliacao_ocorrencias FOR ALL TO authenticated
  USING (auth_is_superadmin() OR empresa_id = auth_empresa_id())
  WITH CHECK (auth_is_superadmin() OR empresa_id = auth_empresa_id());

-- ---- Motor de conciliação: retorno × expectativa (parcelas) → ocorrências ----
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
    WHERE ct.convenio_id = r.convenio_id
      AND ct.empresa_id = r.empresa_id
      AND to_char(p.vencimento, 'YYYY-MM') = r.competencia
      AND p.status IN ('aberta', 'atrasada')
      AND cl.cpf IS NOT NULL
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
    CASE WHEN (u.esperado > 0 AND u.descontado = 0)
           OR (u.esperado = 0 AND u.descontado > 0)
           OR (u.descontado + 0.01 < u.esperado) THEN 'aberta' ELSE 'tratada' END
  FROM uni u;

  UPDATE retornos_folha SET status = 'conciliado', conciliado_em = now() WHERE id = p_retorno;

  SELECT jsonb_object_agg(tipo, n) INTO v_resumo
  FROM (SELECT tipo, count(*) n FROM conciliacao_ocorrencias WHERE retorno_id = p_retorno GROUP BY tipo) t;
  RETURN coalesce(v_resumo, '{}'::jsonb);
END $$;
GRANT EXECUTE ON FUNCTION public.conciliar_retorno(uuid) TO authenticated;
