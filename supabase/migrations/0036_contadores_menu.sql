-- ============================================================
-- CONSIGTEC — Contadores operacionais para badges do menu lateral.
-- Uma chamada devolve os números de pendências por área. Após 0035. Idempotente.
-- ============================================================

CREATE OR REPLACE FUNCTION public.contadores_operacionais()
RETURNS TABLE(
  pendencias_abertas bigint,
  pendencias_criticas bigint,
  propostas_analise bigint,
  averbacoes_pendentes bigint,
  formalizacoes_pendentes bigint,
  cobrancas_abertas bigint,
  contratos_inadimplentes bigint,
  chamados_abertos bigint,
  lgpd_pendentes bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT
    (SELECT count(*) FROM pendencias WHERE status::text IN ('aberta','em_andamento')),
    (SELECT count(*) FROM pendencias WHERE prioridade::text = 'critica' AND status::text IN ('aberta','em_andamento')),
    (SELECT count(*) FROM propostas WHERE status = 'em_analise'),
    (SELECT count(*) FROM averbacoes WHERE status = 'pendente'),
    (SELECT count(*) FROM formalizacoes WHERE status::text IN ('iniciada','em_analise')),
    (SELECT count(*) FROM cobrancas WHERE status IN ('aberta','em_acordo')),
    (SELECT count(*) FROM contratos WHERE status = 'inadimplente'),
    (SELECT count(*) FROM chamados WHERE status::text IN ('aberto','em_andamento')),
    (SELECT count(*) FROM lgpd_solicitacoes WHERE status::text IN ('recebida','em_analise'));
$$;
GRANT EXECUTE ON FUNCTION public.contadores_operacionais() TO authenticated;
