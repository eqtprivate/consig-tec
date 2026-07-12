-- ============================================================
-- CONSIGTEC — Estágio 8 (automação): montagem de lastro da cessão.
--   montar_lastro_cessao → insere no termo os títulos elegíveis (CCB assinada,
--                          contrato ativo/inadimplente, ainda não cedido)
--   trigger de total      → mantém termos_cessao.valor_total = soma dos itens
-- Após 0033. Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- Mantém o valor_total do termo igual à soma dos itens (título).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_itens_cessao_total()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_termo uuid;
BEGIN
  v_termo := COALESCE(NEW.termo_id, OLD.termo_id);
  UPDATE termos_cessao t
     SET valor_total = (SELECT COALESCE(sum(valor), 0) FROM itens_cessao WHERE termo_id = v_termo)
   WHERE t.id = v_termo;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_itens_cessao_total ON itens_cessao;
CREATE TRIGGER trg_itens_cessao_total
  AFTER INSERT OR UPDATE OR DELETE ON itens_cessao
  FOR EACH ROW
  EXECUTE FUNCTION fn_itens_cessao_total();

-- ------------------------------------------------------------
-- Monta o lastro do termo com os títulos elegíveis ainda não cedidos.
-- Título = CCB.numero; valor = saldo devedor do contrato (fallback principal).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.montar_lastro_cessao(p_termo uuid)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_cnt int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM termos_cessao WHERE id = p_termo) THEN
    RAISE EXCEPTION 'Termo % não encontrado', p_termo;
  END IF;

  INSERT INTO itens_cessao (termo_id, ccb_id, titulo, emitente, cpf_cnpj, vencimento, valor)
  SELECT p_termo, cb.id, cb.numero, cl.nome, cl.cpf,
         (SELECT max(pa.vencimento) FROM parcelas pa WHERE pa.contrato_id = ct.id),
         COALESCE(
           NULLIF((SELECT sum(pa.valor) FROM parcelas pa
                    WHERE pa.contrato_id = ct.id AND pa.status IN ('aberta', 'atrasada')), 0),
           cb.valor_principal, ct.valor_principal)
  FROM ccbs cb
  JOIN contratos ct ON ct.id = cb.contrato_id
  JOIN clientes cl ON cl.id = ct.cliente_id
  WHERE cb.status = 'assinada'
    AND ct.status IN ('ativo', 'inadimplente')
    AND NOT EXISTS (SELECT 1 FROM itens_cessao it WHERE it.ccb_id = cb.id);

  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  RETURN v_cnt;   -- o total do termo é recalculado pelo trigger
END;
$$;
GRANT EXECUTE ON FUNCTION public.montar_lastro_cessao(uuid) TO authenticated;
