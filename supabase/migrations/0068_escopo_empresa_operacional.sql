-- ============================================================
-- CONSIGTEC — Consolidação multi-tenant: EMPRESA como unidade operacional.
-- As tabelas operacionais eram escopadas por FRANQUIA (auth_tem_escopo(NULL,
-- franquia_id)). Como o conceito de unidade foi aposentado (usuários não têm
-- mais vínculo de franquia), elas passam a ser escopadas por EMPRESA:
--   comissoes, leads, interacoes, oportunidades, cobrancas, repasses_folha.
-- Adiciona empresa_id (+ backfill via franquia → raiz), trigger de carimbo,
-- índice e reescreve a RLS. Após 0067. Idempotente.
-- ============================================================

-- Trigger robusto: carimba a empresa do autor; se o autor não resolver (ex.:
-- RPC/serviço) e houver franquia, deriva a empresa da franquia.
CREATE OR REPLACE FUNCTION public.set_empresa_operacional()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NEW.empresa_id IS NULL THEN
    NEW.empresa_id := auth_empresa_id();
    IF NEW.empresa_id IS NULL AND NEW.franquia_id IS NOT NULL THEN
      SELECT empresa_id INTO NEW.empresa_id FROM franquias WHERE id = NEW.franquia_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DO $mig$
DECLARE
  t text;
  raiz uuid;
  tabelas text[] := ARRAY['comissoes','leads','interacoes','oportunidades','cobrancas','repasses_folha'];
BEGIN
  SELECT (valor #>> '{}')::uuid INTO raiz FROM configuracoes WHERE chave = 'empresa_raiz';

  FOREACH t IN ARRAY tabelas LOOP
    -- coluna
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id)', t);
    -- backfill via franquia
    EXECUTE format($f$UPDATE %I x SET empresa_id = f.empresa_id
                      FROM franquias f WHERE f.id = x.franquia_id AND x.empresa_id IS NULL$f$, t);
    -- backfill restante → empresa raiz
    IF raiz IS NOT NULL THEN
      EXECUTE format('UPDATE %I SET empresa_id = %L WHERE empresa_id IS NULL', t, raiz);
    END IF;
    -- índice
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_empresa ON %I (empresa_id)', t, t);
    -- trigger de carimbo
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_empresa ON %I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_empresa BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION set_empresa_operacional()', t, t);
  END LOOP;
END $mig$;

-- ---- RLS por empresa (mantém as exceções de dono) ----
DROP POLICY IF EXISTS comissoes_rls ON comissoes;
CREATE POLICY comissoes_rls ON comissoes FOR ALL TO authenticated
  USING (auth_is_superadmin() OR usuario_id = auth.uid() OR empresa_id = auth_empresa_id())
  WITH CHECK (auth_is_superadmin() OR usuario_id = auth.uid() OR empresa_id = auth_empresa_id());

DROP POLICY IF EXISTS leads_rls ON leads;
CREATE POLICY leads_rls ON leads FOR ALL TO authenticated
  USING (auth_is_superadmin() OR responsavel_id = auth.uid() OR empresa_id = auth_empresa_id())
  WITH CHECK (auth_is_superadmin() OR responsavel_id = auth.uid() OR empresa_id = auth_empresa_id());

DROP POLICY IF EXISTS interacoes_rls ON interacoes;
CREATE POLICY interacoes_rls ON interacoes FOR ALL TO authenticated
  USING (auth_is_superadmin() OR operador_id = auth.uid() OR empresa_id = auth_empresa_id())
  WITH CHECK (auth_is_superadmin() OR operador_id = auth.uid() OR empresa_id = auth_empresa_id());

DROP POLICY IF EXISTS oportunidades_rls ON oportunidades;
CREATE POLICY oportunidades_rls ON oportunidades FOR ALL TO authenticated
  USING (auth_is_superadmin() OR operador_id = auth.uid() OR empresa_id = auth_empresa_id())
  WITH CHECK (auth_is_superadmin() OR operador_id = auth.uid() OR empresa_id = auth_empresa_id());

DROP POLICY IF EXISTS cobrancas_rls ON cobrancas;
CREATE POLICY cobrancas_rls ON cobrancas FOR ALL TO authenticated
  USING (auth_is_superadmin() OR empresa_id = auth_empresa_id())
  WITH CHECK (auth_is_superadmin() OR empresa_id = auth_empresa_id());

DROP POLICY IF EXISTS repasses_rls ON repasses_folha;
CREATE POLICY repasses_rls ON repasses_folha FOR ALL TO authenticated
  USING (auth_is_superadmin() OR empresa_id = auth_empresa_id())
  WITH CHECK (auth_is_superadmin() OR empresa_id = auth_empresa_id());
