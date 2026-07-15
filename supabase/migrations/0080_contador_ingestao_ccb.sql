-- ============================================================
-- CONSIGTEC — Contador de CCBs aguardando conferência (Ingestão de CCB).
-- Estende contadores_operacionais() com `ingestoes_conferencia`: nº de
-- documentos ingeridos com status 'aguardando_conferencia' na empresa efetiva.
-- Alimenta o badge do subitem Formalização ▸ Ingestão de CCB no menu lateral.
-- Mantém o filtro por empresa (superadmin: p_empresa; demais: própria empresa).
-- Após 0078 (tabela ingestoes_documento). Idempotente.
-- ============================================================

DROP FUNCTION IF EXISTS public.contadores_operacionais(uuid);
CREATE OR REPLACE FUNCTION public.contadores_operacionais(p_empresa uuid DEFAULT NULL)
RETURNS TABLE(
  pendencias_abertas bigint, pendencias_criticas bigint, propostas_analise bigint,
  averbacoes_pendentes bigint, formalizacoes_pendentes bigint, cobrancas_abertas bigint,
  contratos_inadimplentes bigint, chamados_abertos bigint, lgpd_pendentes bigint,
  ingestoes_conferencia bigint
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
    (SELECT count(*) FROM lgpd_solicitacoes WHERE status::text IN ('recebida','em_analise')), -- global (sem coluna de tenant)
    (SELECT count(*) FROM ingestoes_documento i, emp WHERE i.status = 'aguardando_conferencia'
        AND (emp.e IS NULL OR i.empresa_id = emp.e));
$$;
GRANT EXECUTE ON FUNCTION public.contadores_operacionais(uuid) TO authenticated;
