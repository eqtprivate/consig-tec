-- 0101 — leads: isolamento por EMPRESA (franquia deixa de ser necessária)
--
-- Decisão de produto: separação apenas entre EMPRESAS; dentro da empresa os
-- setores/áreas limitam FUNCIONALIDADES (outra camada), não a linha. Antes, a
-- visibilidade de `leads` derivava só da franquia (auth_tem_escopo(NULL, franquia_id)),
-- então um lead sem franquia ficava invisível. Aqui `leads` ganha `empresa_id` e a
-- RLS passa a enxergar por empresa (admin vê toda a empresa; usuário vinculado à
-- empresa também). Retrocompatível: leads antigos com franquia continuam válidos
-- (o COALESCE de auth_tem_escopo resolve a empresa pela franquia).

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);

-- Backfill: empresa pela franquia; senão, pela do convênio.
UPDATE public.leads l SET empresa_id = COALESCE(
  l.empresa_id,
  (SELECT f.empresa_id FROM public.franquias f WHERE f.id = l.franquia_id),
  (SELECT c.empresa_id FROM public.convenios c WHERE c.id = l.convenio_id)
) WHERE l.empresa_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_empresa ON public.leads(empresa_id);

-- RLS por empresa (com fallback à franquia para dados legados).
DROP POLICY IF EXISTS leads_rls ON public.leads;
CREATE POLICY leads_rls ON public.leads FOR ALL TO authenticated
  USING (auth_is_grupo_admin() OR auth_tem_escopo(empresa_id, franquia_id))
  WITH CHECK (auth_is_grupo_admin() OR auth_tem_escopo(empresa_id, franquia_id));
