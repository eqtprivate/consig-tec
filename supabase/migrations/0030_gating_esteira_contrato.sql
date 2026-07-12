-- ============================================================
-- CONSIGTEC — Estágio 5 (à prova de erro): gating da esteira.
-- Só gera contrato quando a proposta está PRONTA:
--   formalização concluída (selfie/prova de vida/documentos + aceite),
--   antifraude aprovado e averbação averbada.
-- Função de prontidão (para UI) + trava na geração do contrato.
-- Após 0029. Idempotente.
-- ============================================================

CREATE OR REPLACE FUNCTION public.proposta_pronta_para_contrato(p_proposta uuid)
RETURNS TABLE(pronta boolean, motivos text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_form formalizacoes;
  v_af   resultado_antifraude;
  v_avb  status_averbacao;
  v_mot  text[] := '{}';
BEGIN
  SELECT * INTO v_form FROM formalizacoes
   WHERE proposta_id = p_proposta ORDER BY updated_at DESC LIMIT 1;
  IF v_form.id IS NULL THEN
    v_mot := array_append(v_mot, 'Sem formalização registrada.');
  ELSE
    IF v_form.status NOT IN ('concluida', 'aprovada') THEN
      v_mot := array_append(v_mot, 'Formalização não concluída.');
    END IF;
    IF NOT (v_form.selfie_ok AND v_form.prova_vida_ok AND v_form.documentos_ok) THEN
      v_mot := array_append(v_mot, 'Selfie / prova de vida / documentos pendentes.');
    END IF;
    IF NOT v_form.aceite_termo THEN
      v_mot := array_append(v_mot, 'Aceite do termo pendente.');
    END IF;
  END IF;

  SELECT resultado INTO v_af FROM analises_antifraude
   WHERE proposta_id = p_proposta ORDER BY created_at DESC LIMIT 1;
  IF v_af IS NULL THEN
    v_mot := array_append(v_mot, 'Antifraude não avaliado.');
  ELSIF v_af <> 'aprovado' THEN
    v_mot := array_append(v_mot, 'Antifraude não aprovado (' || v_af || ').');
  END IF;

  SELECT status INTO v_avb FROM averbacoes
   WHERE proposta_id = p_proposta ORDER BY updated_at DESC LIMIT 1;
  IF v_avb IS NULL THEN
    v_mot := array_append(v_mot, 'Averbação não realizada.');
  ELSIF v_avb <> 'averbada' THEN
    v_mot := array_append(v_mot, 'Averbação não averbada (' || v_avb || ').');
  END IF;

  RETURN QUERY SELECT (array_length(v_mot, 1) IS NULL), v_mot;
END;
$$;
GRANT EXECUTE ON FUNCTION public.proposta_pronta_para_contrato(uuid) TO authenticated;

-- ------------------------------------------------------------
-- Regera gerar_contrato_de_ccb com a TRAVA de prontidão.
-- (mesma lógica da 0029 + checagem da esteira antes de criar o contrato)
-- ------------------------------------------------------------
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
  v_pronta    boolean;
  v_motivos   text[];
BEGIN
  SELECT * INTO v_ccb FROM ccbs WHERE id = p_ccb;
  IF NOT FOUND THEN RAISE EXCEPTION 'CCB % não encontrada', p_ccb; END IF;

  IF v_ccb.contrato_id IS NOT NULL THEN
    SELECT * INTO v_contrato FROM contratos WHERE id = v_ccb.contrato_id;
    RETURN v_contrato;
  END IF;

  IF v_ccb.proposta_id IS NULL THEN
    RAISE EXCEPTION 'CCB % sem proposta — não é possível gerar contrato.', p_ccb;
  END IF;
  SELECT * INTO v_prop FROM propostas WHERE id = v_ccb.proposta_id;

  -- TRAVA: esteira precisa estar completa
  SELECT pronta, motivos INTO v_pronta, v_motivos
    FROM proposta_pronta_para_contrato(v_prop.id);
  IF NOT v_pronta THEN
    RAISE EXCEPTION 'Esteira incompleta para gerar contrato: %', array_to_string(v_motivos, ' ');
  END IF;

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

  UPDATE ccbs SET contrato_id = v_contrato.id WHERE id = p_ccb;
  UPDATE propostas SET status = 'aprovada' WHERE id = v_prop.id AND status <> 'aprovada';
  PERFORM gerar_cronograma_contrato(v_contrato.id);

  RETURN v_contrato;
END;
$$;
GRANT EXECUTE ON FUNCTION public.gerar_contrato_de_ccb(uuid) TO authenticated;
