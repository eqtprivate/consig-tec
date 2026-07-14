-- ============================================================
-- CONSIGTEC — Multi-tenant (Fase 6: Dashboard executivo + séries por empresa).
-- Escopa os RPCs de agregação do dashboard por empresa (fecha o leak
-- cross-tenant e faz o switcher "ver como" refletir nos KPIs/gráficos).
-- não-superadmin: própria empresa; superadmin: p_empresa (NULL = todas).
-- Após 0056. Idempotente.
-- ============================================================

DROP FUNCTION IF EXISTS public.dashboard_executivo();
CREATE OR REPLACE FUNCTION public.dashboard_executivo(p_empresa uuid DEFAULT NULL)
RETURNS TABLE(
  margem_elegivel numeric, margem_prioritaria numeric, tomadores_elegiveis bigint,
  propostas_analise bigint, margem_reservada numeric, averbacoes_averbadas bigint,
  margem_efetivada numeric, contratos_ativos bigint, vop numeric, vf numeric,
  saldo_devedor numeric, contratos_inadimplentes bigint, saldo_atraso numeric,
  cobrancas_abertas bigint, valor_cobrancas numeric, comissoes_previstas numeric,
  comissoes_pagas numeric, termos_cessao bigint, valor_cedido numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  WITH emp AS (SELECT auth_empresa_efetiva(p_empresa) AS e)
  SELECT
    (SELECT COALESCE(sum(margem_disponivel), 0) FROM capacidade_por_convenio(p_empresa)),
    (SELECT COALESCE(sum(margem_disponivel), 0) FROM capacidade_por_convenio(p_empresa) WHERE prioridade_comercial IN ('alta','media')),
    (SELECT COALESCE(sum(tomadores), 0) FROM capacidade_por_convenio(p_empresa)),
    (SELECT count(*) FROM propostas pr, emp WHERE pr.status = 'em_analise' AND (emp.e IS NULL OR pr.empresa_id = emp.e)),
    (SELECT COALESCE(sum(r.valor), 0) FROM reservas_margem r, emp WHERE r.status = 'reservada'
        AND (emp.e IS NULL OR EXISTS (SELECT 1 FROM propostas p WHERE p.id = r.proposta_id AND p.empresa_id = emp.e))),
    (SELECT count(*) FROM averbacoes a, emp WHERE a.status = 'averbada'
        AND (emp.e IS NULL OR EXISTS (SELECT 1 FROM contratos c WHERE c.id = a.contrato_id AND c.empresa_id = emp.e))),
    (SELECT COALESCE(sum(r.valor), 0) FROM reservas_margem r, emp WHERE r.status = 'efetivada'
        AND (emp.e IS NULL OR EXISTS (SELECT 1 FROM propostas p WHERE p.id = r.proposta_id AND p.empresa_id = emp.e))),
    (SELECT count(*) FROM contratos c, emp WHERE c.status = 'ativo' AND (emp.e IS NULL OR c.empresa_id = emp.e)),
    (SELECT COALESCE(sum(c.valor_principal), 0) FROM contratos c, emp WHERE c.status IN ('ativo','inadimplente') AND (emp.e IS NULL OR c.empresa_id = emp.e)),
    (SELECT COALESCE(sum(COALESCE(c.valor_total, c.valor_principal)), 0) FROM contratos c, emp WHERE c.status IN ('ativo','inadimplente') AND (emp.e IS NULL OR c.empresa_id = emp.e)),
    (SELECT COALESCE(sum(cc.saldo_devedor), 0) FROM carteira_contratos() cc JOIN contratos c ON c.id = cc.contrato_id, emp WHERE (emp.e IS NULL OR c.empresa_id = emp.e)),
    (SELECT count(*) FROM contratos c, emp WHERE c.status = 'inadimplente' AND (emp.e IS NULL OR c.empresa_id = emp.e)),
    (SELECT COALESCE(sum(cc.saldo_devedor), 0) FROM carteira_contratos() cc JOIN contratos c ON c.id = cc.contrato_id, emp WHERE cc.parcelas_atrasadas > 0 AND (emp.e IS NULL OR c.empresa_id = emp.e)),
    (SELECT count(*) FROM cobrancas cb, emp WHERE cb.status IN ('aberta','em_acordo')
        AND (emp.e IS NULL OR EXISTS (SELECT 1 FROM contratos c WHERE c.id = cb.contrato_id AND c.empresa_id = emp.e))),
    (SELECT COALESCE(sum(cb.valor), 0) FROM cobrancas cb, emp WHERE cb.status IN ('aberta','em_acordo')
        AND (emp.e IS NULL OR EXISTS (SELECT 1 FROM contratos c WHERE c.id = cb.contrato_id AND c.empresa_id = emp.e))),
    (SELECT COALESCE(sum(co.valor), 0) FROM comissoes co, emp WHERE co.status = 'prevista'
        AND (emp.e IS NULL OR EXISTS (SELECT 1 FROM contratos c WHERE c.id = co.contrato_id AND c.empresa_id = emp.e))),
    (SELECT COALESCE(sum(co.valor), 0) FROM comissoes co, emp WHERE co.status = 'paga'
        AND (emp.e IS NULL OR EXISTS (SELECT 1 FROM contratos c WHERE c.id = co.contrato_id AND c.empresa_id = emp.e))),
    (SELECT count(*) FROM termos_cessao t, emp WHERE t.status <> 'cancelada' AND (emp.e IS NULL OR t.empresa_id = emp.e)),
    (SELECT COALESCE(sum(t.valor_total), 0) FROM termos_cessao t, emp WHERE t.status <> 'cancelada' AND (emp.e IS NULL OR t.empresa_id = emp.e));
$$;
GRANT EXECUTE ON FUNCTION public.dashboard_executivo(uuid) TO authenticated;

-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.evolucao_mensal(int);
CREATE OR REPLACE FUNCTION public.evolucao_mensal(p_meses int DEFAULT 6, p_empresa uuid DEFAULT NULL)
RETURNS TABLE(competencia text, contratos bigint, vop numeric, parcelas_vencidas bigint, valor_vencido numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  WITH emp AS (SELECT auth_empresa_efetiva(p_empresa) AS e),
  meses AS (
    SELECT to_char(date_trunc('month', current_date) - (n || ' month')::interval, 'YYYY-MM') AS competencia
    FROM generate_series(0, GREATEST(p_meses, 1) - 1) n
  )
  SELECT
    m.competencia,
    (SELECT count(*) FROM contratos c, emp
      WHERE to_char(COALESCE(c.data_assinatura, c.created_at::date), 'YYYY-MM') = m.competencia
        AND (emp.e IS NULL OR c.empresa_id = emp.e)),
    (SELECT COALESCE(sum(c.valor_principal), 0) FROM contratos c, emp
      WHERE to_char(COALESCE(c.data_assinatura, c.created_at::date), 'YYYY-MM') = m.competencia
        AND (emp.e IS NULL OR c.empresa_id = emp.e)),
    (SELECT count(*) FROM parcelas p, emp
      WHERE p.status IN ('atrasada') AND to_char(p.vencimento, 'YYYY-MM') = m.competencia
        AND (emp.e IS NULL OR EXISTS (SELECT 1 FROM contratos c WHERE c.id = p.contrato_id AND c.empresa_id = emp.e))),
    (SELECT COALESCE(sum(p.valor), 0) FROM parcelas p, emp
      WHERE p.status IN ('atrasada') AND to_char(p.vencimento, 'YYYY-MM') = m.competencia
        AND (emp.e IS NULL OR EXISTS (SELECT 1 FROM contratos c WHERE c.id = p.contrato_id AND c.empresa_id = emp.e)))
  FROM meses m
  ORDER BY m.competencia;
$$;
GRANT EXECUTE ON FUNCTION public.evolucao_mensal(int, uuid) TO authenticated;

-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.ranking_convenios_producao(int);
CREATE OR REPLACE FUNCTION public.ranking_convenios_producao(p_limite int DEFAULT 8, p_empresa uuid DEFAULT NULL)
RETURNS TABLE(convenio_id uuid, convenio text, cidade text, prioridade_comercial prioridade_comercial, contratos bigint, vop numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT
    cv.id, cv.nome, COALESCE(e.cidade, cv.orgao), cv.prioridade_comercial,
    count(c.id), COALESCE(sum(c.valor_principal), 0)
  FROM convenios cv
  LEFT JOIN entidades_cadastro e ON e.id = cv.entidade_id
  JOIN contratos c ON c.convenio_id = cv.id AND c.status IN ('ativo', 'inadimplente')
  WHERE (auth_empresa_efetiva(p_empresa) IS NULL OR cv.empresa_id = auth_empresa_efetiva(p_empresa))
  GROUP BY cv.id, cv.nome, e.cidade, cv.orgao, cv.prioridade_comercial
  ORDER BY COALESCE(sum(c.valor_principal), 0) DESC
  LIMIT GREATEST(p_limite, 1);
$$;
GRANT EXECUTE ON FUNCTION public.ranking_convenios_producao(int, uuid) TO authenticated;
