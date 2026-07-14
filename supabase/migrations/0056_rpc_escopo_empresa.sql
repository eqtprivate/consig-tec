-- ============================================================
-- CONSIGTEC — Multi-tenant (Fase 5: RPCs de agregação por empresa).
-- Os RPCs SECURITY DEFINER agregavam TODOS os tenants (vazamento cross-tenant
-- para admin de empresa). Passam a filtrar por empresa:
--   * não-superadmin: sempre a PRÓPRIA empresa (auth_empresa_id) — fecha o leak.
--   * superadmin: aceita p_empresa (o "ver como" do switcher); NULL = todas.
-- Após 0055. Idempotente.
-- ============================================================

-- Garante a coluna usada por capacidade_por_convenio (a migração 0026 pode não
-- ter sido aplicada neste banco). Idempotente.
ALTER TABLE matriculas ADD COLUMN IF NOT EXISTS margem_atualizada_em timestamptz;

-- Empresa efetiva para filtro: superadmin pode focar (p_empresa), demais são
-- travados na própria empresa.
CREATE OR REPLACE FUNCTION public.auth_empresa_efetiva(p_empresa uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT CASE WHEN auth_is_superadmin() THEN p_empresa ELSE auth_empresa_id() END;
$$;
GRANT EXECUTE ON FUNCTION public.auth_empresa_efetiva(uuid) TO authenticated;

-- ------------------------------------------------------------
-- capacidade_por_convenio(p_empresa) — filtra convênios por empresa.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.capacidade_por_convenio();
CREATE OR REPLACE FUNCTION public.capacidade_por_convenio(p_empresa uuid DEFAULT NULL)
RETURNS TABLE(
  convenio_id uuid, nome text, cidade text, uf text,
  prioridade_comercial prioridade_comercial, potencial_vendas int, ativo boolean,
  tomadores bigint, vinculos_elegiveis bigint, margem_disponivel numeric,
  margem_utilizada numeric, ticket_medio_margem numeric, base_atualizada_em timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT
    c.id, c.nome, COALESCE(e.cidade, c.orgao) AS cidade, e.uf,
    c.prioridade_comercial, c.potencial_vendas, c.ativo,
    count(DISTINCT m.cliente_id) FILTER (WHERE eleg.ok) AS tomadores,
    count(*) FILTER (WHERE eleg.ok) AS vinculos_elegiveis,
    COALESCE(sum(m.margem_disponivel) FILTER (WHERE eleg.ok), 0) AS margem_disponivel,
    COALESCE(sum(m.margem_utilizada) FILTER (WHERE eleg.ok), 0) AS margem_utilizada,
    CASE WHEN count(*) FILTER (WHERE eleg.ok) > 0
         THEN round(COALESCE(sum(m.margem_disponivel) FILTER (WHERE eleg.ok), 0)
                    / count(*) FILTER (WHERE eleg.ok), 2)
         ELSE 0 END AS ticket_medio_margem,
    max(m.margem_atualizada_em) AS base_atualizada_em
  FROM convenios c
  LEFT JOIN entidades_cadastro e ON e.id = c.entidade_id
  LEFT JOIN matriculas m ON m.convenio_id = c.id
  LEFT JOIN LATERAL (
    SELECT (m.id IS NOT NULL
            AND m.situacao IN ('ativo','aposentado','pensionista')
            AND c.ativo AND c.tipo_margem IN ('apartada','cartao')
            AND COALESCE(m.margem_disponivel, 0) > 0) AS ok
  ) eleg ON true
  WHERE (auth_empresa_efetiva(p_empresa) IS NULL OR c.empresa_id = auth_empresa_efetiva(p_empresa))
  GROUP BY c.id, c.nome, e.cidade, c.orgao, e.uf, c.prioridade_comercial, c.potencial_vendas, c.ativo;
$$;
GRANT EXECUTE ON FUNCTION public.capacidade_por_convenio(uuid) TO authenticated;

-- ------------------------------------------------------------
-- contadores_operacionais(p_empresa) — cada contador filtrado por empresa
-- (direto por empresa_id, ou via contrato/proposta/franquia).
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.contadores_operacionais();
CREATE OR REPLACE FUNCTION public.contadores_operacionais(p_empresa uuid DEFAULT NULL)
RETURNS TABLE(
  pendencias_abertas bigint, pendencias_criticas bigint, propostas_analise bigint,
  averbacoes_pendentes bigint, formalizacoes_pendentes bigint, cobrancas_abertas bigint,
  contratos_inadimplentes bigint, chamados_abertos bigint, lgpd_pendentes bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  WITH emp AS (SELECT auth_empresa_efetiva(p_empresa) AS e)
  SELECT
    (SELECT count(*) FROM pendencias p, emp WHERE p.status::text IN ('aberta','em_andamento')
        AND (emp.e IS NULL OR p.empresa_id = emp.e)),
    (SELECT count(*) FROM pendencias p, emp WHERE p.prioridade::text = 'critica' AND p.status::text IN ('aberta','em_andamento')
        AND (emp.e IS NULL OR p.empresa_id = emp.e)),
    (SELECT count(*) FROM propostas pr, emp WHERE pr.status = 'em_analise'
        AND (emp.e IS NULL OR pr.empresa_id = emp.e)),
    (SELECT count(*) FROM averbacoes a, emp WHERE a.status = 'pendente'
        AND (emp.e IS NULL OR EXISTS (SELECT 1 FROM contratos c WHERE c.id = a.contrato_id AND c.empresa_id = emp.e))),
    (SELECT count(*) FROM formalizacoes f, emp WHERE f.status::text IN ('iniciada','em_analise')
        AND (emp.e IS NULL
             OR EXISTS (SELECT 1 FROM propostas p WHERE p.id = f.proposta_id AND p.empresa_id = emp.e)
             OR EXISTS (SELECT 1 FROM contratos c WHERE c.id = f.contrato_id AND c.empresa_id = emp.e))),
    (SELECT count(*) FROM cobrancas cb, emp WHERE cb.status IN ('aberta','em_acordo')
        AND (emp.e IS NULL OR EXISTS (SELECT 1 FROM contratos c WHERE c.id = cb.contrato_id AND c.empresa_id = emp.e))),
    (SELECT count(*) FROM contratos c, emp WHERE c.status = 'inadimplente'
        AND (emp.e IS NULL OR c.empresa_id = emp.e)),
    (SELECT count(*) FROM chamados ch, emp WHERE ch.status::text IN ('aberto','em_andamento')
        AND (emp.e IS NULL OR EXISTS (SELECT 1 FROM franquias fr WHERE fr.id = ch.franquia_id AND fr.empresa_id = emp.e))),
    (SELECT count(*) FROM lgpd_solicitacoes WHERE status::text IN ('recebida','em_analise')); -- global (sem coluna de tenant)
$$;
GRANT EXECUTE ON FUNCTION public.contadores_operacionais(uuid) TO authenticated;
