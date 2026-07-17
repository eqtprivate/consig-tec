-- 0098 — Padrões (templates) de CCB
--
-- Cada emissor de CCB tem um layout próprio: os campos ficam em páginas
-- diferentes. A leitura por IA envia só as páginas úteis (rápido + preciso), e
-- QUAIS páginas depende do padrão. Aqui guardamos os padrões; o usuário escolhe
-- um antes de subir o arquivo. Padrões globais (empresa_id NULL) são geridos
-- pelo superadmin; uma empresa pode ter padrões próprios.

CREATE TABLE IF NOT EXISTS public.ccb_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid REFERENCES public.empresas(id) ON DELETE CASCADE,  -- NULL = global
  nome        text NOT NULL,
  descricao   text,
  paginas     jsonb NOT NULL DEFAULT '[]'::jsonb,  -- ex.: [1,2,13,14,15] (1-indexed)
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ccb_templates ENABLE ROW LEVEL SECURITY;

-- Leitura: padrões ativos globais OU da empresa do usuário (superadmin vê tudo).
DROP POLICY IF EXISTS ccb_templates_sel ON public.ccb_templates;
CREATE POLICY ccb_templates_sel ON public.ccb_templates FOR SELECT TO authenticated
  USING (auth_is_superadmin() OR (ativo AND (empresa_id IS NULL OR empresa_id = auth_empresa_id())));

-- Gestão: superadmin (qualquer) ou admin da empresa (só os próprios).
DROP POLICY IF EXISTS ccb_templates_ins ON public.ccb_templates;
CREATE POLICY ccb_templates_ins ON public.ccb_templates FOR INSERT TO authenticated
  WITH CHECK (auth_is_superadmin() OR (auth_is_empresa_admin() AND empresa_id = auth_empresa_id()));

DROP POLICY IF EXISTS ccb_templates_upd ON public.ccb_templates;
CREATE POLICY ccb_templates_upd ON public.ccb_templates FOR UPDATE TO authenticated
  USING (auth_is_superadmin() OR (auth_is_empresa_admin() AND empresa_id = auth_empresa_id()))
  WITH CHECK (auth_is_superadmin() OR (auth_is_empresa_admin() AND empresa_id = auth_empresa_id()));

DROP POLICY IF EXISTS ccb_templates_del ON public.ccb_templates;
CREATE POLICY ccb_templates_del ON public.ccb_templates FOR DELETE TO authenticated
  USING (auth_is_superadmin() OR (auth_is_empresa_admin() AND empresa_id = auth_empresa_id()));

-- Guarda, na ingestão, qual padrão/páginas foram usados (para reprocessar igual).
ALTER TABLE public.ingestoes_documento
  ADD COLUMN IF NOT EXISTS ccb_template_id uuid REFERENCES public.ccb_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ccb_paginas     jsonb;

-- Seed do padrão UY3 (global).
INSERT INTO public.ccb_templates (empresa_id, nome, descricao, paginas)
SELECT NULL, 'UY3', 'CCB padrão UY3 Sociedade de Crédito Direto S.A.', '[1,2,13,14,15]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.ccb_templates WHERE empresa_id IS NULL AND nome = 'UY3');
