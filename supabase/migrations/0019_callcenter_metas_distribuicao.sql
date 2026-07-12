-- ============================================================
-- CONSIGTEC — Call center: metas do operador + acesso do operador aos
-- seus leads (distribuição). Aplicar após 0018. Idempotente.
-- ============================================================

-- Operador enxerga leads atribuídos a ele (responsavel_id), além do escopo
-- de franquia. Recria a policy de leads incluindo responsavel_id.
DROP POLICY IF EXISTS leads_rls ON leads;
CREATE POLICY leads_rls ON leads FOR ALL TO authenticated
  USING (auth_is_grupo_admin() OR auth_tem_escopo(NULL, franquia_id) OR responsavel_id = auth.uid())
  WITH CHECK (auth_is_grupo_admin() OR auth_tem_escopo(NULL, franquia_id) OR responsavel_id = auth.uid());

-- ------------------------------------------------------------
-- METAS DO OPERADOR (por competência)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS metas_operador (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operador_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  franquia_id uuid REFERENCES franquias(id),
  competencia text NOT NULL,               -- 'YYYY-MM'
  meta_ligacoes int,
  meta_qualificados int,
  meta_vendas int,
  meta_valor numeric(14,2),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (operador_id, competencia)
);
CREATE INDEX IF NOT EXISTS idx_metas_operador ON metas_operador(operador_id);
CREATE INDEX IF NOT EXISTS idx_metas_competencia ON metas_operador(competencia);

DROP TRIGGER IF EXISTS trg_metas_updated ON metas_operador;
CREATE TRIGGER trg_metas_updated BEFORE UPDATE ON metas_operador FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE metas_operador ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS metas_rls ON metas_operador;
CREATE POLICY metas_rls ON metas_operador FOR ALL TO authenticated
  USING (auth_is_grupo_admin() OR operador_id = auth.uid() OR auth_tem_escopo(NULL, franquia_id))
  WITH CHECK (auth_is_grupo_admin() OR auth_tem_escopo(NULL, franquia_id));

-- ------------------------------------------------------------
-- FUNÇÃO: produtividade do call center por operador (período)
-- Agrega interações, contatos efetivos, qualificações e oportunidades.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.produtividade_callcenter(p_de date, p_ate date)
RETURNS TABLE(
  operador_id uuid, operador text,
  interacoes bigint, atendimentos bigint, qualificados bigint,
  oportunidades bigint, ganhas bigint, valor_ganho numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  WITH i AS (
    SELECT operador_id,
           count(*) AS interacoes,
           count(*) FILTER (WHERE resultado = 'atendeu') AS atendimentos,
           count(*) FILTER (WHERE resultado = 'qualificado') AS qualificados
    FROM interacoes
    WHERE created_at::date BETWEEN p_de AND p_ate
    GROUP BY operador_id
  ), o AS (
    SELECT operador_id,
           count(*) AS oportunidades,
           count(*) FILTER (WHERE etapa = 'ganha') AS ganhas,
           coalesce(sum(valor_estimado) FILTER (WHERE etapa = 'ganha'), 0) AS valor_ganho
    FROM oportunidades
    WHERE created_at::date BETWEEN p_de AND p_ate
    GROUP BY operador_id
  )
  SELECT u.id, u.nome,
         coalesce(i.interacoes,0), coalesce(i.atendimentos,0), coalesce(i.qualificados,0),
         coalesce(o.oportunidades,0), coalesce(o.ganhas,0), coalesce(o.valor_ganho,0)
  FROM usuarios u
  LEFT JOIN i ON i.operador_id = u.id
  LEFT JOIN o ON o.operador_id = u.id
  WHERE coalesce(i.interacoes,0) > 0 OR coalesce(o.oportunidades,0) > 0
  ORDER BY coalesce(i.interacoes,0) DESC;
$$;
GRANT EXECUTE ON FUNCTION public.produtividade_callcenter(date, date) TO authenticated;
