-- ============================================================
-- CONSIGTEC — Estágio 11 (automação): cobrança ligada à inadimplência.
--   gerar_cobrancas_inadimplencia → abre 1 cobrança por parcela atrasada sem
--                                    cobrança ativa
--   registrar_pagamento_parcela   → passa a resolver a cobrança da parcela paga
--   atualizar_carteira            → também gera as cobranças (one-click)
-- Após 0032. Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- Gera cobranças de inadimplência a partir das parcelas atrasadas.
-- Não duplica: pula parcela que já tenha cobrança aberta/em acordo.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gerar_cobrancas_inadimplencia()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_cnt int;
BEGIN
  INSERT INTO cobrancas (contrato_id, parcela_id, franquia_id, gatilho, status, valor, data_gatilho, observacao)
  SELECT p.contrato_id, p.id, c.franquia_id, 'inadimplencia', 'aberta', p.valor, p.vencimento,
         'Gerada automaticamente — parcela ' || p.numero || ' em atraso'
  FROM parcelas p
  JOIN contratos c ON c.id = p.contrato_id
  WHERE p.status = 'atrasada'
    AND NOT EXISTS (
      SELECT 1 FROM cobrancas cb
       WHERE cb.parcela_id = p.id AND cb.status IN ('aberta', 'em_acordo')
    );
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  RETURN v_cnt;
END;
$$;
GRANT EXECUTE ON FUNCTION public.gerar_cobrancas_inadimplencia() TO authenticated;

-- ------------------------------------------------------------
-- Baixa de parcela agora RESOLVE a cobrança da parcela (se houver).
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

  -- resolve cobranças abertas dessa parcela
  UPDATE cobrancas
     SET status = 'resolvida',
         observacao = COALESCE(observacao, '') || ' | parcela paga em ' || COALESCE(p_data, current_date)
   WHERE parcela_id = p_parcela AND status IN ('aberta', 'em_acordo');

  -- quita o contrato se não restam parcelas em aberto/atraso
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
-- atualizar_carteira agora também gera as cobranças de inadimplência.
-- (assinatura muda → DROP + CREATE)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.atualizar_carteira();
CREATE FUNCTION public.atualizar_carteira()
RETURNS TABLE(parcelas_atrasadas int, contratos_inadimplentes int, contratos_quitados int, cobrancas_geradas int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_pa int; v_ci int; v_cq int; v_cob int;
BEGIN
  UPDATE parcelas SET status = 'atrasada'
   WHERE status = 'aberta' AND vencimento < current_date;
  GET DIAGNOSTICS v_pa = ROW_COUNT;

  UPDATE contratos c SET status = 'inadimplente'
   WHERE c.status = 'ativo'
     AND EXISTS (SELECT 1 FROM parcelas p WHERE p.contrato_id = c.id AND p.status = 'atrasada');
  GET DIAGNOSTICS v_ci = ROW_COUNT;

  UPDATE contratos c SET status = 'ativo'
   WHERE c.status = 'inadimplente'
     AND NOT EXISTS (SELECT 1 FROM parcelas p WHERE p.contrato_id = c.id AND p.status = 'atrasada')
     AND EXISTS (SELECT 1 FROM parcelas p WHERE p.contrato_id = c.id AND p.status IN ('aberta'));

  UPDATE contratos c SET status = 'quitado'
   WHERE c.status IN ('ativo', 'inadimplente')
     AND EXISTS (SELECT 1 FROM parcelas p WHERE p.contrato_id = c.id)
     AND NOT EXISTS (SELECT 1 FROM parcelas p WHERE p.contrato_id = c.id AND p.status IN ('aberta', 'atrasada'));
  GET DIAGNOSTICS v_cq = ROW_COUNT;

  v_cob := gerar_cobrancas_inadimplencia();

  RETURN QUERY SELECT v_pa, v_ci, v_cq, v_cob;
END;
$$;
GRANT EXECUTE ON FUNCTION public.atualizar_carteira() TO authenticated;
