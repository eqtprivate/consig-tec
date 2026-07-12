-- ============================================================
-- CONSIGTEC — Séries do dashboard: evolução mensal + ranking de convênios.
-- Após 0036. Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- Evolução mensal (últimos N meses): produção (contratos assinados) e
-- inadimplência (parcelas vencidas não pagas por competência de vencimento).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.evolucao_mensal(p_meses int DEFAULT 6)
RETURNS TABLE(
  competencia text,
  contratos bigint,
  vop numeric,
  parcelas_vencidas bigint,
  valor_vencido numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  WITH meses AS (
    SELECT to_char(date_trunc('month', current_date) - (n || ' month')::interval, 'YYYY-MM') AS competencia
    FROM generate_series(0, GREATEST(p_meses, 1) - 1) n
  )
  SELECT
    m.competencia,
    (SELECT count(*) FROM contratos c
      WHERE to_char(COALESCE(c.data_assinatura, c.created_at::date), 'YYYY-MM') = m.competencia),
    (SELECT COALESCE(sum(c.valor_principal), 0) FROM contratos c
      WHERE to_char(COALESCE(c.data_assinatura, c.created_at::date), 'YYYY-MM') = m.competencia),
    (SELECT count(*) FROM parcelas p
      WHERE p.status IN ('atrasada')
        AND to_char(p.vencimento, 'YYYY-MM') = m.competencia),
    (SELECT COALESCE(sum(p.valor), 0) FROM parcelas p
      WHERE p.status IN ('atrasada')
        AND to_char(p.vencimento, 'YYYY-MM') = m.competencia)
  FROM meses m
  ORDER BY m.competencia;
$$;
GRANT EXECUTE ON FUNCTION public.evolucao_mensal(int) TO authenticated;

-- ------------------------------------------------------------
-- Ranking de convênios por produção (VOP dos contratos ativos/inadimplentes).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ranking_convenios_producao(p_limite int DEFAULT 8)
RETURNS TABLE(
  convenio_id uuid,
  convenio text,
  cidade text,
  prioridade_comercial prioridade_comercial,
  contratos bigint,
  vop numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT
    cv.id,
    cv.nome,
    COALESCE(e.cidade, cv.orgao),
    cv.prioridade_comercial,
    count(c.id),
    COALESCE(sum(c.valor_principal), 0)
  FROM convenios cv
  LEFT JOIN entidades_cadastro e ON e.id = cv.entidade_id
  JOIN contratos c ON c.convenio_id = cv.id AND c.status IN ('ativo', 'inadimplente')
  GROUP BY cv.id, cv.nome, e.cidade, cv.orgao, cv.prioridade_comercial
  ORDER BY COALESCE(sum(c.valor_principal), 0) DESC
  LIMIT GREATEST(p_limite, 1);
$$;
GRANT EXECUTE ON FUNCTION public.ranking_convenios_producao(int) TO authenticated;
