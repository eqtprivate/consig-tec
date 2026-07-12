-- ============================================================
-- CONSIGTEC — Estágio 6 (pós-contrato): baixa de parcelas + carteira.
--   registrar_pagamento_parcela  → baixa a parcela e quita o contrato se
--                                    todas estiverem pagas
--   atualizar_carteira           → marca parcelas vencidas como atrasadas e
--                                    reflete status do contrato (inadimplente/
--                                    quitado/ativo)
--   carteira_contratos           → visão da carteira (saldo devedor, atraso)
-- Após 0030. Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- Baixa de parcela (pagamento) — cascateia para o status do contrato.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_pagamento_parcela(
  p_parcela uuid, p_valor numeric DEFAULT NULL, p_data date DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_par parcelas;
BEGIN
  SELECT * INTO v_par FROM parcelas WHERE id = p_parcela;
  IF NOT FOUND THEN RAISE EXCEPTION 'Parcela % não encontrada', p_parcela; END IF;

  UPDATE parcelas
     SET status = 'paga',
         valor_pago = COALESCE(p_valor, v_par.valor),
         data_pagamento = COALESCE(p_data, current_date)
   WHERE id = p_parcela;

  -- Se não restam parcelas em aberto/atraso, quita o contrato.
  IF NOT EXISTS (
    SELECT 1 FROM parcelas
     WHERE contrato_id = v_par.contrato_id AND status IN ('aberta', 'atrasada')
  ) THEN
    UPDATE contratos SET status = 'quitado' WHERE id = v_par.contrato_id AND status <> 'quitado';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.registrar_pagamento_parcela(uuid, numeric, date) TO authenticated;

-- ------------------------------------------------------------
-- Atualiza a carteira: parcelas vencidas → atrasadas; status dos contratos.
-- Chamável sob demanda (botão) ou por agenda (pg_cron futuro).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.atualizar_carteira()
RETURNS TABLE(parcelas_atrasadas int, contratos_inadimplentes int, contratos_quitados int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_pa int; v_ci int; v_cq int;
BEGIN
  -- vencidas e não pagas → atrasada
  UPDATE parcelas
     SET status = 'atrasada'
   WHERE status = 'aberta' AND vencimento < current_date;
  GET DIAGNOSTICS v_pa = ROW_COUNT;

  -- contratos com parcela atrasada → inadimplente
  UPDATE contratos c
     SET status = 'inadimplente'
   WHERE c.status = 'ativo'
     AND EXISTS (SELECT 1 FROM parcelas p WHERE p.contrato_id = c.id AND p.status = 'atrasada');
  GET DIAGNOSTICS v_ci = ROW_COUNT;

  -- inadimplentes que regularizaram (sem atraso) → volta a ativo
  UPDATE contratos c
     SET status = 'ativo'
   WHERE c.status = 'inadimplente'
     AND NOT EXISTS (SELECT 1 FROM parcelas p WHERE p.contrato_id = c.id AND p.status = 'atrasada')
     AND EXISTS (SELECT 1 FROM parcelas p WHERE p.contrato_id = c.id AND p.status IN ('aberta'));

  -- todas pagas → quitado
  UPDATE contratos c
     SET status = 'quitado'
   WHERE c.status IN ('ativo', 'inadimplente')
     AND EXISTS (SELECT 1 FROM parcelas p WHERE p.contrato_id = c.id)
     AND NOT EXISTS (SELECT 1 FROM parcelas p WHERE p.contrato_id = c.id AND p.status IN ('aberta', 'atrasada'));
  GET DIAGNOSTICS v_cq = ROW_COUNT;

  RETURN QUERY SELECT v_pa, v_ci, v_cq;
END;
$$;
GRANT EXECUTE ON FUNCTION public.atualizar_carteira() TO authenticated;

-- ------------------------------------------------------------
-- Visão da carteira por contrato (saldo devedor, atraso, aging).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.carteira_contratos()
RETURNS TABLE(
  contrato_id uuid,
  numero_contrato text,
  cliente text,
  convenio text,
  status status_contrato,
  valor_principal numeric,
  prazo int,
  parcelas_pagas int,
  parcelas_abertas int,
  parcelas_atrasadas int,
  saldo_devedor numeric,
  proximo_vencimento date,
  dias_atraso int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT
    c.id,
    c.numero_contrato,
    cl.nome,
    cv.nome,
    c.status,
    c.valor_principal,
    c.prazo,
    count(*) FILTER (WHERE p.status = 'paga')::int,
    count(*) FILTER (WHERE p.status = 'aberta')::int,
    count(*) FILTER (WHERE p.status = 'atrasada')::int,
    COALESCE(sum(p.valor) FILTER (WHERE p.status IN ('aberta', 'atrasada')), 0),
    min(p.vencimento) FILTER (WHERE p.status IN ('aberta', 'atrasada')),
    COALESCE(max(current_date - p.vencimento) FILTER (WHERE p.status = 'atrasada'), 0)::int
  FROM contratos c
  LEFT JOIN parcelas p ON p.contrato_id = c.id
  LEFT JOIN clientes cl ON cl.id = c.cliente_id
  LEFT JOIN convenios cv ON cv.id = c.convenio_id
  GROUP BY c.id, c.numero_contrato, cl.nome, cv.nome, c.status, c.valor_principal, c.prazo;
$$;
GRANT EXECUTE ON FUNCTION public.carteira_contratos() TO authenticated;
