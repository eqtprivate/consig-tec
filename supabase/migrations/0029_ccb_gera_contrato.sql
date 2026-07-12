-- ============================================================
-- CONSIGTEC — Estágio 5 (robustez): CCB assinada gera o CONTRATO.
-- Fecha proposta → formalização → CCB → CONTRATO:
--   CCB 'assinada' → cria contrato (nº, principal/prazo/taxa/parcela),
--   vincula a CCB, marca a proposta aprovada e gera o cronograma (Price).
-- Após 0028. Idempotente.
-- ============================================================

CREATE OR REPLACE FUNCTION public.gerar_contrato_de_ccb(p_ccb uuid)
RETURNS contratos
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_ccb       ccbs;
  v_prop      propostas;
  v_contrato  contratos;
  v_num       text;
  v_principal numeric;
  v_taxa      numeric;
  v_prazo     int;
BEGIN
  SELECT * INTO v_ccb FROM ccbs WHERE id = p_ccb;
  IF NOT FOUND THEN RAISE EXCEPTION 'CCB % não encontrada', p_ccb; END IF;

  -- já vinculada a um contrato? retorna-o (idempotência)
  IF v_ccb.contrato_id IS NOT NULL THEN
    SELECT * INTO v_contrato FROM contratos WHERE id = v_ccb.contrato_id;
    RETURN v_contrato;
  END IF;

  IF v_ccb.proposta_id IS NULL THEN
    RAISE EXCEPTION 'CCB % sem proposta — não é possível gerar contrato.', p_ccb;
  END IF;
  SELECT * INTO v_prop FROM propostas WHERE id = v_ccb.proposta_id;

  v_principal := COALESCE(v_ccb.valor_principal, v_prop.valor_solicitado);
  v_taxa      := COALESCE(v_ccb.taxa_mensal, v_prop.taxa_mensal);
  v_prazo     := COALESCE(v_ccb.prazo, v_prop.prazo);
  IF v_principal IS NULL OR v_prazo IS NULL OR v_prazo <= 0 THEN
    RAISE EXCEPTION 'CCB % sem valor/prazo para gerar contrato.', p_ccb;
  END IF;

  v_num := 'CT-' || to_char(now(), 'YYYYMM') || '-' || upper(substr(replace(p_ccb::text, '-', ''), 1, 6));

  INSERT INTO contratos (proposta_id, cliente_id, convenio_id, empresa_id, franquia_id,
                         numero_contrato, valor_principal, prazo, taxa_mensal,
                         valor_parcela, data_assinatura, status)
  VALUES (v_prop.id, v_prop.cliente_id, v_prop.convenio_id, v_prop.empresa_id, v_prop.franquia_id,
          v_num, v_principal, v_prazo, v_taxa,
          COALESCE(v_prop.valor_parcela, calcular_pmt(v_principal, COALESCE(v_taxa, 0), v_prazo)),
          COALESCE(v_ccb.assinada_em::date, current_date), 'ativo')
  RETURNING * INTO v_contrato;

  -- vincula CCB, aprova a proposta e gera o cronograma
  UPDATE ccbs SET contrato_id = v_contrato.id WHERE id = p_ccb;
  UPDATE propostas SET status = 'aprovada' WHERE id = v_prop.id AND status <> 'aprovada';
  PERFORM gerar_cronograma_contrato(v_contrato.id);

  RETURN v_contrato;
END;
$$;
GRANT EXECUTE ON FUNCTION public.gerar_contrato_de_ccb(uuid) TO authenticated;

-- ------------------------------------------------------------
-- Trigger: ao assinar a CCB (ligada a proposta, sem contrato), gera o contrato.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ccb_gera_contrato()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status)
     AND NEW.status = 'assinada'
     AND NEW.contrato_id IS NULL
     AND NEW.proposta_id IS NOT NULL THEN
    PERFORM gerar_contrato_de_ccb(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ccb_gera_contrato ON ccbs;
CREATE TRIGGER trg_ccb_gera_contrato
  AFTER INSERT OR UPDATE OF status ON ccbs
  FOR EACH ROW
  EXECUTE FUNCTION fn_ccb_gera_contrato();
