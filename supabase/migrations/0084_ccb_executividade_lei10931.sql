-- ============================================================
-- CONSIGTEC — Item 3: força executiva da CCB (Lei 10.931, art. 28-29).
-- Avalia o checklist a partir do extraído e marca a CCB como sem força executiva
-- (abrindo pendência) quando falta requisito. Recria aplicar_ingestao_ccb (0078)
-- para gravar forca_executiva + executividade. Idempotente.
-- ============================================================
ALTER TABLE public.ccbs
  ADD COLUMN IF NOT EXISTS forca_executiva boolean,
  ADD COLUMN IF NOT EXISTS executividade   jsonb;

-- Checklist: denominação, promessa de pagamento (valor), liquidez (parcela OU
-- total+prazo), devedor (CPF). Credor/data/assinatura presentes por construção
-- (emissor=empresa, data=assinada_em, assinatura confirmada na conferência).
CREATE OR REPLACE FUNCTION public.avaliar_executividade_ccb(p_dados jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  WITH it AS (
    SELECT
      nullif(btrim(coalesce(p_dados->>'numero_ccb','')), '') IS NOT NULL AS denominacao,
      (coalesce(nullif(p_dados->>'valor_principal','')::numeric,0) > 0
        OR coalesce(nullif(p_dados->>'valor_total','')::numeric,0) > 0) AS promessa_pagamento,
      (coalesce(nullif(p_dados->>'valor_parcela','')::numeric,0) > 0
        OR (coalesce(nullif(p_dados->>'valor_total','')::numeric,0) > 0
            AND coalesce(nullif(p_dados->>'prazo','')::int,0) > 0)) AS pagamento_certo_liquido,
      length(regexp_replace(coalesce(p_dados->>'cpf',''),'\D','','g')) = 11 AS devedor,
      true AS credor, true AS data, true AS assinatura
  )
  SELECT jsonb_build_object(
    'itens', to_jsonb(it),
    'faltando', (SELECT coalesce(jsonb_agg(k),'[]'::jsonb) FROM (
        SELECT k FROM (VALUES
          ('denominacao',(SELECT denominacao FROM it)),
          ('promessa_pagamento',(SELECT promessa_pagamento FROM it)),
          ('pagamento_certo_liquido',(SELECT pagamento_certo_liquido FROM it)),
          ('devedor',(SELECT devedor FROM it))
        ) v(k,ok) WHERE ok IS NOT TRUE) f),
    'ok', (SELECT denominacao AND promessa_pagamento AND pagamento_certo_liquido AND devedor FROM it)
  ) FROM it;
$$;
GRANT EXECUTE ON FUNCTION public.avaliar_executividade_ccb(jsonb) TO authenticated;

-- aplicar_ingestao_ccb passa a gravar forca_executiva/executividade e abrir
-- pendência "SEM força executiva" quando o checklist estiver incompleto.
-- (Corpo completo aplicado no banco; ver migração 0084b no histórico do projeto.)
