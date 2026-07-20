-- 0103 — Portão LGPD para enriquecimento de dados
--
-- Enriquecer leads com dados pessoais (telefone/e-mail) exige BASE LEGAL registrada
-- (LGPD). Aqui, por convênio, guarda-se a finalidade + base legal + um flag ativo.
-- O motor consolidar_leads só aplica fontes de MODO 'enriquecimento' quando existe
-- uma base ativa para o convênio; senão, ignora essas fontes (as de 'origem' seguem).

CREATE TABLE IF NOT EXISTS public.enriquecimento_lgpd (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL REFERENCES public.empresas(id)  ON DELETE CASCADE,
  convenio_id   uuid NOT NULL REFERENCES public.convenios(id) ON DELETE CASCADE,
  base_legal    text NOT NULL,            -- ex.: 'legitimo_interesse', 'consentimento', 'execucao_contrato'
  finalidade    text NOT NULL,            -- descrição da finalidade do tratamento
  ativo         boolean NOT NULL DEFAULT true,
  registrado_por uuid REFERENCES public.usuarios(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, convenio_id)
);
CREATE INDEX IF NOT EXISTS enriquecimento_lgpd_convenio_idx ON public.enriquecimento_lgpd (convenio_id);

ALTER TABLE public.enriquecimento_lgpd ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS enriquecimento_lgpd_sel ON public.enriquecimento_lgpd;
CREATE POLICY enriquecimento_lgpd_sel ON public.enriquecimento_lgpd FOR SELECT TO authenticated
  USING (auth_is_superadmin() OR empresa_id = auth_empresa_id());
DROP POLICY IF EXISTS enriquecimento_lgpd_ins ON public.enriquecimento_lgpd;
CREATE POLICY enriquecimento_lgpd_ins ON public.enriquecimento_lgpd FOR INSERT TO authenticated
  WITH CHECK (auth_is_superadmin() OR (auth_is_empresa_admin() AND empresa_id = auth_empresa_id()));
DROP POLICY IF EXISTS enriquecimento_lgpd_upd ON public.enriquecimento_lgpd;
CREATE POLICY enriquecimento_lgpd_upd ON public.enriquecimento_lgpd FOR UPDATE TO authenticated
  USING (auth_is_superadmin() OR (auth_is_empresa_admin() AND empresa_id = auth_empresa_id()))
  WITH CHECK (auth_is_superadmin() OR (auth_is_empresa_admin() AND empresa_id = auth_empresa_id()));
DROP POLICY IF EXISTS enriquecimento_lgpd_del ON public.enriquecimento_lgpd;
CREATE POLICY enriquecimento_lgpd_del ON public.enriquecimento_lgpd FOR DELETE TO authenticated
  USING (auth_is_superadmin() OR (auth_is_empresa_admin() AND empresa_id = auth_empresa_id()));
