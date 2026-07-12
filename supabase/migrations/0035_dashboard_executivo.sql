-- ============================================================
-- CONSIGTEC — Dashboard executivo: consolidação da esteira em 1 chamada.
-- Agrega capacidade → pipeline → produção → carteira → cobrança →
-- comissões → cessão (visão do grupo). Após 0034. Idempotente.
-- ============================================================

CREATE OR REPLACE FUNCTION public.dashboard_executivo()
RETURNS TABLE(
  margem_elegivel numeric,
  margem_prioritaria numeric,
  tomadores_elegiveis bigint,
  propostas_analise bigint,
  margem_reservada numeric,
  averbacoes_averbadas bigint,
  margem_efetivada numeric,
  contratos_ativos bigint,
  vop numeric,
  vf numeric,
  saldo_devedor numeric,
  contratos_inadimplentes bigint,
  saldo_atraso numeric,
  cobrancas_abertas bigint,
  valor_cobrancas numeric,
  comissoes_previstas numeric,
  comissoes_pagas numeric,
  termos_cessao bigint,
  valor_cedido numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT
    (SELECT COALESCE(sum(margem_disponivel), 0) FROM capacidade_por_convenio()),
    (SELECT COALESCE(sum(margem_disponivel), 0) FROM capacidade_por_convenio() WHERE prioridade_comercial IN ('alta','media')),
    (SELECT COALESCE(sum(tomadores), 0) FROM capacidade_por_convenio()),
    (SELECT count(*) FROM propostas WHERE status = 'em_analise'),
    (SELECT COALESCE(sum(valor), 0) FROM reservas_margem WHERE status = 'reservada'),
    (SELECT count(*) FROM averbacoes WHERE status = 'averbada'),
    (SELECT COALESCE(sum(valor), 0) FROM reservas_margem WHERE status = 'efetivada'),
    (SELECT count(*) FROM contratos WHERE status = 'ativo'),
    (SELECT COALESCE(sum(valor_principal), 0) FROM contratos WHERE status IN ('ativo','inadimplente')),
    (SELECT COALESCE(sum(COALESCE(valor_total, valor_principal)), 0) FROM contratos WHERE status IN ('ativo','inadimplente')),
    (SELECT COALESCE(sum(saldo_devedor), 0) FROM carteira_contratos()),
    (SELECT count(*) FROM contratos WHERE status = 'inadimplente'),
    (SELECT COALESCE(sum(saldo_devedor), 0) FROM carteira_contratos() WHERE parcelas_atrasadas > 0),
    (SELECT count(*) FROM cobrancas WHERE status IN ('aberta','em_acordo')),
    (SELECT COALESCE(sum(valor), 0) FROM cobrancas WHERE status IN ('aberta','em_acordo')),
    (SELECT COALESCE(sum(valor), 0) FROM comissoes WHERE status = 'prevista'),
    (SELECT COALESCE(sum(valor), 0) FROM comissoes WHERE status = 'paga'),
    (SELECT count(*) FROM termos_cessao WHERE status <> 'cancelada'),
    (SELECT COALESCE(sum(valor_total), 0) FROM termos_cessao WHERE status <> 'cancelada');
$$;
GRANT EXECUTE ON FUNCTION public.dashboard_executivo() TO authenticated;
