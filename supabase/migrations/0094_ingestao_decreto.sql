-- ============================================================
-- CONSIGTEC — Ingestão de DECRETOS/LEIS de convênios (leitura por IA).
-- Reusa a espinha da CCB (ingestoes_documento + config + log de tentativas +
-- cota do plano). O decreto lido vira SUGESTÃO de regras; um humano confere e
-- aplica ao convênio (aplicar_regras_decreto). Nada muda no convênio sem
-- aprovação. Após 0093. Idempotente/aditivo.
-- ============================================================

-- 1) Vínculo do documento ao convênio (decretos apontam para um convênio;
--    CCBs continuam usando proposta_id/ccb_id e deixam este nulo).
ALTER TABLE public.ingestoes_documento
  ADD COLUMN IF NOT EXISTS convenio_id uuid REFERENCES convenios(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ingestao_convenio ON ingestoes_documento (convenio_id);

-- 2) Regras/proveniência do decreto no convênio. As colunas de regra "core"
--    (teto_parcelas, prioridade_desconto, margem_por_produto) já existem (0083);
--    aqui só acrescentamos o que o decreto traz e a rastreabilidade da norma.
ALTER TABLE public.convenios
  ADD COLUMN IF NOT EXISTS decreto_numero               text,
  ADD COLUMN IF NOT EXISTS decreto_data                 date,
  ADD COLUMN IF NOT EXISTS lei_base                     text,
  ADD COLUMN IF NOT EXISTS margem_total_pct             numeric(5,2),
  ADD COLUMN IF NOT EXISTS margem_cartao_pct            numeric(5,2),
  ADD COLUMN IF NOT EXISTS limite_adiantamento_pct      numeric(5,2),
  ADD COLUMN IF NOT EXISTS recomposicao_margem_horas    int,
  ADD COLUMN IF NOT EXISTS reposicao_erario             text,
  ADD COLUMN IF NOT EXISTS tipos_consignacao_permitidos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS consignatarias_habilitadas   jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS decreto_ingestao_id          uuid REFERENCES ingestoes_documento(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decreto_dados                jsonb,
  ADD COLUMN IF NOT EXISTS regras_origem                text; -- 'decreto' | 'manual' | 'pixconsig'

COMMENT ON COLUMN public.convenios.decreto_dados IS 'JSON integral extraído do decreto pela IA (auditoria/reprocesso).';
COMMENT ON COLUMN public.convenios.margem_total_pct IS 'Margem consignável total autorizada pelo decreto (%).';
COMMENT ON COLUMN public.convenios.margem_cartao_pct IS 'Parcela da margem exclusiva de cartão (%), dentro do total.';

-- ------------------------------------------------------------
-- Aplica as regras conferidas de um decreto ao convênio escolhido.
-- SECURITY DEFINER; exige admin da empresa (ou superadmin) e escopo da empresa.
-- COALESCE preserva o que já existe quando o campo vier nulo. Marca a ingestão
-- como aprovada (tipo_documento='decreto'), audita, e devolve o convenio_id.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aplicar_regras_decreto(
  p_ingestao uuid,
  p_convenio uuid,
  p_dados jsonb,
  p_justificativa text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  ing        ingestoes_documento;
  v_conv     convenios;
  v_prazo    int;
  v_prio     int;
  v_mtot     numeric;
  v_mcard    numeric;
  v_adiant   numeric;
  v_recomp   int;
  v_margem   jsonb;
BEGIN
  SELECT * INTO ing FROM ingestoes_documento WHERE id = p_ingestao;
  IF ing.id IS NULL THEN RAISE EXCEPTION 'Ingestão não encontrada.'; END IF;
  IF NOT (auth_is_superadmin() OR (auth_is_empresa_admin() AND ing.empresa_id = auth_empresa_id())) THEN
    RAISE EXCEPTION 'Sem permissão.';
  END IF;
  -- Idempotência: já aplicada → devolve o convênio vinculado.
  IF ing.status = 'aprovado' AND ing.convenio_id IS NOT NULL THEN
    RETURN ing.convenio_id;
  END IF;

  IF p_convenio IS NULL THEN RAISE EXCEPTION 'Selecione o convênio para aplicar as regras.'; END IF;
  SELECT * INTO v_conv FROM convenios WHERE id = p_convenio;
  IF v_conv.id IS NULL THEN RAISE EXCEPTION 'Convênio não encontrado.'; END IF;
  IF NOT (auth_is_superadmin() OR v_conv.empresa_id = auth_empresa_id()) THEN
    RAISE EXCEPTION 'Convênio fora do escopo da sua empresa.';
  END IF;

  v_prazo  := nullif(p_dados->>'prazo_maximo_meses', '')::int;
  v_prio   := nullif(p_dados->>'prioridade_desconto', '')::int;
  v_mtot   := nullif(p_dados->>'margem_total_pct', '')::numeric;
  v_mcard  := nullif(p_dados->>'margem_cartao_pct', '')::numeric;
  v_adiant := nullif(p_dados->>'limite_adiantamento_pct', '')::numeric;
  v_recomp := nullif(p_dados->>'recomposicao_margem_horas', '')::int;

  -- margem_por_produto: mescla o que veio do decreto (total/cartão) sem apagar o resto.
  v_margem := coalesce(v_conv.margem_por_produto, '{}'::jsonb)
              || jsonb_strip_nulls(jsonb_build_object('total', v_mtot, 'cartao', v_mcard));

  UPDATE convenios SET
    teto_parcelas                = coalesce(v_prazo, teto_parcelas),
    prazo_maximo                 = coalesce(v_prazo, prazo_maximo),
    prioridade_desconto          = coalesce(v_prio, prioridade_desconto),
    margem_por_produto           = v_margem,
    margem_total_pct             = coalesce(v_mtot, margem_total_pct),
    margem_cartao_pct            = coalesce(v_mcard, margem_cartao_pct),
    limite_adiantamento_pct      = coalesce(v_adiant, limite_adiantamento_pct),
    recomposicao_margem_horas    = coalesce(v_recomp, recomposicao_margem_horas),
    reposicao_erario             = coalesce(nullif(p_dados->>'reposicao_erario', ''), reposicao_erario),
    lei_base                     = coalesce(nullif(p_dados->>'lei_base', ''), lei_base),
    decreto_numero               = coalesce(nullif(p_dados->>'decreto_numero', ''), decreto_numero),
    decreto_data                 = coalesce(nullif(p_dados->>'decreto_data', '')::date, decreto_data),
    tipos_consignacao_permitidos = coalesce(p_dados->'tipos_consignacao_permitidos', tipos_consignacao_permitidos),
    consignatarias_habilitadas   = coalesce(p_dados->'consignatarias_habilitadas', consignatarias_habilitadas),
    decreto_dados                = p_dados,
    decreto_ingestao_id          = p_ingestao,
    regras_origem                = 'decreto',
    regras_manuais               = false,
    regras_atualizadas_em        = now()
  WHERE id = p_convenio;

  UPDATE ingestoes_documento
     SET status = 'aprovado', convenio_id = p_convenio,
         aprovado_por = auth.uid(), aprovado_em = now(),
         observacao = coalesce(nullif(btrim(p_justificativa), ''), observacao)
   WHERE id = p_ingestao;

  INSERT INTO auditoria (entidade, registro_id, acao, empresa_id, valor_novo)
  VALUES ('convenios', p_convenio, 'aplicar_regras_decreto', ing.empresa_id,
          jsonb_build_object('ingestao', p_ingestao, 'decreto', p_dados->>'decreto_numero',
                             'justificativa', p_justificativa));

  RETURN p_convenio;
END $$;
GRANT EXECUTE ON FUNCTION public.aplicar_regras_decreto(uuid, uuid, jsonb, text) TO authenticated;
