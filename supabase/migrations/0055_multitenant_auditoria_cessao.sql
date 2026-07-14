-- ============================================================
-- CONSIGTEC — Multi-tenant (Fase 4: AUDITORIA e CESSÃO por empresa).
-- * auditoria ganha empresa_id (auto-carimbado) e passa a ser lida pelo admin
--   DA PRÓPRIA empresa (antes: superadmin-only).
-- * cessão: fecha a leitura aberta (USING true = vazamento cross-tenant) e
--   escopa termos_cessao + filhos por empresa; catálogo (fundos/cedentes/etc)
--   fica visível a admin, escrita superadmin.
-- Após 0054. Idempotente.
-- ============================================================

-- helper: id da empresa raiz (EmpresteiCard)
CREATE OR REPLACE FUNCTION public._empresa_raiz() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT (valor #>> '{}')::uuid FROM configuracoes WHERE chave = 'empresa_raiz' $$;

-- ------------------------------------------------------------
-- AUDITORIA por empresa
-- ------------------------------------------------------------
ALTER TABLE auditoria ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id);
CREATE INDEX IF NOT EXISTS idx_auditoria_empresa ON auditoria(empresa_id, created_at DESC);
UPDATE auditoria SET empresa_id = public._empresa_raiz() WHERE empresa_id IS NULL;

-- Carimba empresa_id do autor automaticamente (não depende do cliente).
CREATE OR REPLACE FUNCTION public.auditoria_set_empresa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NEW.empresa_id IS NULL THEN NEW.empresa_id := auth_empresa_id(); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_auditoria_empresa ON auditoria;
CREATE TRIGGER trg_auditoria_empresa BEFORE INSERT ON auditoria FOR EACH ROW EXECUTE FUNCTION auditoria_set_empresa();

-- Leitura: superadmin tudo; admin só a própria empresa. Inserção: qualquer
-- autenticado (é log; o trigger carimba a empresa).
DROP POLICY IF EXISTS audit_admin ON auditoria;
DROP POLICY IF EXISTS audit_read ON auditoria;
CREATE POLICY audit_read ON auditoria FOR SELECT TO authenticated
  USING (auth_is_superadmin() OR (auth_is_empresa_admin() AND empresa_id = auth_empresa_id()));
DROP POLICY IF EXISTS audit_insert ON auditoria;
CREATE POLICY audit_insert ON auditoria FOR INSERT TO authenticated WITH CHECK (true);

-- ------------------------------------------------------------
-- CESSÃO por empresa
-- ------------------------------------------------------------
ALTER TABLE termos_cessao ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id);
UPDATE termos_cessao SET empresa_id = public._empresa_raiz() WHERE empresa_id IS NULL;

-- termos_cessao: tenant-aware.
DROP POLICY IF EXISTS termos_cessao_read ON termos_cessao;
DROP POLICY IF EXISTS termos_cessao_admin ON termos_cessao;
DROP POLICY IF EXISTS termos_cessao_rls ON termos_cessao;
CREATE POLICY termos_cessao_rls ON termos_cessao FOR ALL TO authenticated
  USING (auth_tem_escopo(empresa_id, NULL)) WITH CHECK (auth_tem_escopo(empresa_id, NULL));

-- Filhos: escopo herdado do termo (join).
DROP POLICY IF EXISTS itens_cessao_read ON itens_cessao;
DROP POLICY IF EXISTS itens_cessao_admin ON itens_cessao;
CREATE POLICY itens_cessao_rls ON itens_cessao FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM termos_cessao tc WHERE tc.id = itens_cessao.termo_id AND auth_tem_escopo(tc.empresa_id, NULL)))
  WITH CHECK (EXISTS (SELECT 1 FROM termos_cessao tc WHERE tc.id = itens_cessao.termo_id AND auth_tem_escopo(tc.empresa_id, NULL)));

DROP POLICY IF EXISTS dados_deposito_cessao_read ON dados_deposito_cessao;
DROP POLICY IF EXISTS dados_deposito_cessao_admin ON dados_deposito_cessao;
CREATE POLICY dados_deposito_cessao_rls ON dados_deposito_cessao FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM termos_cessao tc WHERE tc.id = dados_deposito_cessao.termo_id AND auth_tem_escopo(tc.empresa_id, NULL)))
  WITH CHECK (EXISTS (SELECT 1 FROM termos_cessao tc WHERE tc.id = dados_deposito_cessao.termo_id AND auth_tem_escopo(tc.empresa_id, NULL)));

DROP POLICY IF EXISTS assinaturas_cessao_read ON assinaturas_cessao;
DROP POLICY IF EXISTS assinaturas_cessao_admin ON assinaturas_cessao;
CREATE POLICY assinaturas_cessao_rls ON assinaturas_cessao FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM termos_cessao tc WHERE tc.id = assinaturas_cessao.termo_id AND auth_tem_escopo(tc.empresa_id, NULL)))
  WITH CHECK (EXISTS (SELECT 1 FROM termos_cessao tc WHERE tc.id = assinaturas_cessao.termo_id AND auth_tem_escopo(tc.empresa_id, NULL)));

-- Catálogo/contrapartes + PDD: leitura a admin (não mais a todo autenticado),
-- escrita a superadmin.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['gestoras', 'administradoras', 'cedentes', 'fundos', 'pdd_carteira']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_read ON %I', t, t);
    EXECUTE format('CREATE POLICY %I_read ON %I FOR SELECT TO authenticated USING (auth_is_empresa_admin())', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_admin ON %I', t, t);
    EXECUTE format('CREATE POLICY %I_admin ON %I FOR ALL TO authenticated USING (auth_is_superadmin()) WITH CHECK (auth_is_superadmin())', t, t);
  END LOOP;
END $$;
