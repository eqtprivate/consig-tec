-- ============================================================
-- CONSIGTEC — Estágio 1 (fechamento): capacidade por município/convênio.
-- Margem apartada ELEGÍVEL disponível × prioridade comercial × metas,
-- ligando o cadastro (convênios/vínculos) ao planejamento do comercial.
-- Após 0024. Idempotente.
-- ============================================================

-- Capacidade agregada por convênio (município): quantos vínculos elegíveis,
-- quantos tomadores, margem apartada disponível/utilizada. A elegibilidade
-- espelha matricula_elegivel_cartao / elegivelCartaoBeneficio (situação do
-- vínculo + convênio ativo com margem apartada/cartão + margem > 0).
CREATE OR REPLACE FUNCTION public.capacidade_por_convenio()
RETURNS TABLE(
  convenio_id uuid,
  nome text,
  cidade text,
  uf text,
  prioridade_comercial prioridade_comercial,
  potencial_vendas int,
  ativo boolean,
  tomadores bigint,
  vinculos_elegiveis bigint,
  margem_disponivel numeric,
  margem_utilizada numeric,
  ticket_medio_margem numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT
    c.id,
    c.nome,
    COALESCE(e.cidade, c.orgao) AS cidade,
    e.uf,
    c.prioridade_comercial,
    c.potencial_vendas,
    c.ativo,
    count(DISTINCT m.cliente_id) FILTER (WHERE eleg.ok) AS tomadores,
    count(*) FILTER (WHERE eleg.ok) AS vinculos_elegiveis,
    COALESCE(sum(m.margem_disponivel) FILTER (WHERE eleg.ok), 0) AS margem_disponivel,
    COALESCE(sum(m.margem_utilizada) FILTER (WHERE eleg.ok), 0) AS margem_utilizada,
    CASE WHEN count(*) FILTER (WHERE eleg.ok) > 0
         THEN round(COALESCE(sum(m.margem_disponivel) FILTER (WHERE eleg.ok), 0)
                    / count(*) FILTER (WHERE eleg.ok), 2)
         ELSE 0 END AS ticket_medio_margem
  FROM convenios c
  LEFT JOIN entidades_cadastro e ON e.id = c.entidade_id
  LEFT JOIN matriculas m ON m.convenio_id = c.id
  LEFT JOIN LATERAL (
    SELECT (m.id IS NOT NULL
            AND m.situacao IN ('ativo','aposentado','pensionista')
            AND c.ativo
            AND c.tipo_margem IN ('apartada','cartao')
            AND COALESCE(m.margem_disponivel, 0) > 0) AS ok
  ) eleg ON true
  GROUP BY c.id, c.nome, e.cidade, c.orgao, e.uf, c.prioridade_comercial, c.potencial_vendas, c.ativo;
$$;
GRANT EXECUTE ON FUNCTION public.capacidade_por_convenio() TO authenticated;
