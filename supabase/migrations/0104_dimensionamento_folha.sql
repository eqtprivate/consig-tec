-- 0104 — Dimensionamento da base capturada (agrega lead_staging por convênio)
--
-- Alimenta o "dimensionamento de mercado" (Capacidade) a partir da folha capturada
-- na Originação de Leads. Deduplica por pessoa (chave_dedup) pegando a leitura MAIS
-- RECENTE (evita inflar a soma quando a consolidação roda mais de uma vez). Tenant
-- via SECURITY DEFINER + filtro por empresa (superadmin vê tudo).

CREATE OR REPLACE FUNCTION public.dimensionamento_folha(p_convenio uuid, p_competencia text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT DISTINCT ON (chave_dedup)
           chave_dedup, remuneracao_bruta, remuneracao_liquida, capacidade_margem, orgao
    FROM public.lead_staging
    WHERE convenio_id = p_convenio
      AND (p_competencia IS NULL OR competencia = p_competencia)
      AND chave_dedup IS NOT NULL
      AND (auth_is_superadmin() OR empresa_id = auth_empresa_id())
    ORDER BY chave_dedup, created_at DESC
  )
  SELECT jsonb_build_object(
    'servidores',                 count(*),
    'massa_bruta',                coalesce(sum(remuneracao_bruta), 0),
    'massa_liquida',              coalesce(sum(remuneracao_liquida), 0),
    'ticket_medio_bruto',         coalesce(round(avg(remuneracao_bruta), 2), 0),
    'capacidade_margem_estimada', coalesce(sum(coalesce(capacidade_margem, remuneracao_liquida * 0.30, remuneracao_bruta * 0.30, 0)), 0),
    'orgaos',                     count(DISTINCT orgao) FILTER (WHERE orgao IS NOT NULL)
  )
  FROM base;
$$;

GRANT EXECUTE ON FUNCTION public.dimensionamento_folha(uuid, text) TO authenticated;

-- Competências disponíveis para um convênio (para o seletor do dimensionamento).
CREATE OR REPLACE FUNCTION public.competencias_lead_staging(p_convenio uuid)
RETURNS TABLE (competencia text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT competencia FROM public.lead_staging
  WHERE convenio_id = p_convenio AND competencia IS NOT NULL
    AND (auth_is_superadmin() OR empresa_id = auth_empresa_id())
  ORDER BY competencia DESC;
$$;

GRANT EXECUTE ON FUNCTION public.competencias_lead_staging(uuid) TO authenticated;
