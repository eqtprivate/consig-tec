-- ============================================================
-- CONSIGTEC — Multi-tenant (Fase 2: ISOLAMENTO por RLS).
-- Reescreve os helpers centrais de acesso para isolar por EMPRESA:
--   * superadmin (2 contas CONSIGTEC): cross-tenant, vê tudo.
--   * admin: administra a PRÓPRIA empresa (tenant), não vê outras.
--   * usuario: dentro da empresa, limitado por vínculos (área/franquia).
-- Como quase toda política de negócio roteia por auth_tem_escopo/auth_can_access,
-- redefinir esses helpers isola os dados sem tocar política por política.
-- SEGURANÇA: superadmin sempre faz bypass — não há como se trancar fora.
-- Requer a 0052 aplicada (empresa_id preenchido). Idempotente. Após 0052.
-- ============================================================

-- 1) Empresa (tenant) do usuário logado.
CREATE OR REPLACE FUNCTION public.auth_empresa_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT empresa_id FROM usuarios WHERE id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.auth_empresa_id() TO authenticated;

-- 2) Admin DENTRO do tenant (admin OU superadmin).
CREATE OR REPLACE FUNCTION public.auth_is_empresa_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT coalesce((SELECT role IN ('admin', 'superadmin') FROM usuarios WHERE id = auth.uid()), false);
$$;
GRANT EXECUTE ON FUNCTION public.auth_is_empresa_admin() TO authenticated;

-- 3) grupo_admin passa a ser SOMENTE superadmin (cross-tenant / CONSIGTEC).
--    Remove o bypass global do 'admin' que existia antes.
CREATE OR REPLACE FUNCTION public.auth_is_grupo_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT coalesce((SELECT role = 'superadmin' FROM usuarios WHERE id = auth.uid()), false);
$$;

-- 4) Escopo tenant-aware: superadmin tudo; senão a linha tem que ser da MINHA
--    empresa (empresa direta ou empresa da franquia); admin vê toda a empresa,
--    usuário comum precisa de vínculo na franquia/empresa.
CREATE OR REPLACE FUNCTION public.auth_tem_escopo(p_empresa uuid, p_franquia uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE emp uuid; me uuid;
BEGIN
  IF auth_is_superadmin() THEN RETURN true; END IF;
  me := auth_empresa_id();
  emp := COALESCE(p_empresa, (SELECT empresa_id FROM franquias WHERE id = p_franquia));
  IF emp IS NULL OR emp IS DISTINCT FROM me THEN RETURN false; END IF;
  IF auth_is_empresa_admin() THEN RETURN true; END IF;
  RETURN EXISTS (
    SELECT 1 FROM vinculos v
     WHERE v.usuario_id = auth.uid() AND v.ativo
       AND ((p_franquia IS NOT NULL AND v.franquia_id = p_franquia)
         OR (p_empresa  IS NOT NULL AND v.empresa_id  = p_empresa)));
END $$;

-- 5) can_access = escopo + área (usado por pendencias/threads).
CREATE OR REPLACE FUNCTION public.auth_can_access(p_empresa uuid, p_franquia uuid, p_area uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE emp uuid; me uuid;
BEGIN
  IF auth_is_superadmin() THEN RETURN true; END IF;
  me := auth_empresa_id();
  emp := COALESCE(p_empresa, (SELECT empresa_id FROM franquias WHERE id = p_franquia));
  IF emp IS NULL OR emp IS DISTINCT FROM me THEN RETURN false; END IF;
  IF auth_is_empresa_admin() THEN RETURN true; END IF;
  RETURN EXISTS (
    SELECT 1 FROM vinculos v
     WHERE v.usuario_id = auth.uid() AND v.ativo AND v.area_id = p_area
       AND ((p_franquia IS NOT NULL AND v.franquia_id = p_franquia)
         OR (p_empresa  IS NOT NULL AND v.empresa_id  = p_empresa)));
END $$;

-- ------------------------------------------------------------
-- Políticas que usavam grupo_admin de forma "standalone" e precisam
-- continuar disponíveis ao admin DA EMPRESA (agora com escopo por empresa).
-- ------------------------------------------------------------

-- usuarios: admin enxerga/gerencia usuários da PRÓPRIA empresa (papel 'usuario').
DROP POLICY IF EXISTS usuarios_self ON usuarios;
CREATE POLICY usuarios_self ON usuarios FOR SELECT TO authenticated
  USING (id = auth.uid() OR auth_is_superadmin()
      OR (auth_is_empresa_admin() AND empresa_id = auth_empresa_id()));

DROP POLICY IF EXISTS usuarios_insert ON usuarios;
CREATE POLICY usuarios_insert ON usuarios FOR INSERT TO authenticated
  WITH CHECK (auth_is_superadmin()
      OR (auth_is_empresa_admin() AND empresa_id = auth_empresa_id() AND role = 'usuario'));

DROP POLICY IF EXISTS usuarios_update ON usuarios;
CREATE POLICY usuarios_update ON usuarios FOR UPDATE TO authenticated
  USING (auth_is_superadmin()
      OR (auth_is_empresa_admin() AND empresa_id = auth_empresa_id() AND role = 'usuario'))
  WITH CHECK (auth_is_superadmin()
      OR (auth_is_empresa_admin() AND empresa_id = auth_empresa_id() AND role = 'usuario'));

DROP POLICY IF EXISTS usuarios_delete ON usuarios;
CREATE POLICY usuarios_delete ON usuarios FOR DELETE TO authenticated
  USING (auth_is_superadmin()
      OR (auth_is_empresa_admin() AND empresa_id = auth_empresa_id() AND role = 'usuario'));

-- vinculos: admin vê/gerencia vínculos de usuários da própria empresa
-- (e não pode conceder papéis 'admin%' — só superadmin).
DROP POLICY IF EXISTS vinculos_self ON vinculos;
CREATE POLICY vinculos_self ON vinculos FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR auth_is_superadmin()
      OR (auth_is_empresa_admin() AND EXISTS (
            SELECT 1 FROM usuarios u WHERE u.id = vinculos.usuario_id AND u.empresa_id = auth_empresa_id())));

DROP POLICY IF EXISTS vinculos_admin ON vinculos;
CREATE POLICY vinculos_admin ON vinculos FOR ALL TO authenticated
  USING (
    auth_is_superadmin()
    OR (auth_is_empresa_admin()
        AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = usuario_id AND u.empresa_id = auth_empresa_id())
        AND EXISTS (SELECT 1 FROM papeis p WHERE p.id = papel_id AND coalesce(p.codigo, '') NOT LIKE 'admin%')))
  WITH CHECK (
    auth_is_superadmin()
    OR (auth_is_empresa_admin()
        AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = usuario_id AND u.empresa_id = auth_empresa_id())
        AND EXISTS (SELECT 1 FROM papeis p WHERE p.id = papel_id AND coalesce(p.codigo, '') NOT LIKE 'admin%')));

-- empresas / franquias: todos veem a própria empresa e suas franquias.
DROP POLICY IF EXISTS "empresas_scope" ON empresas;
CREATE POLICY "empresas_scope" ON empresas FOR SELECT TO authenticated
  USING (auth_is_superadmin() OR id = auth_empresa_id()
      OR id IN (SELECT empresa_id FROM vinculos WHERE usuario_id = auth.uid() AND ativo AND empresa_id IS NOT NULL));

DROP POLICY IF EXISTS "franquias_scope" ON franquias;
CREATE POLICY "franquias_scope" ON franquias FOR SELECT TO authenticated
  USING (auth_is_superadmin()
      OR (auth_is_empresa_admin() AND empresa_id = auth_empresa_id())
      OR id IN (SELECT franquia_id FROM vinculos WHERE usuario_id = auth.uid() AND ativo AND franquia_id IS NOT NULL));

-- notificações: mantém leitura para admin (o sino in-app depende disso).
DROP POLICY IF EXISTS "notif_read" ON notificacoes;
CREATE POLICY "notif_read" ON notificacoes FOR SELECT TO authenticated
  USING (auth_is_empresa_admin());

-- aplicar_tipo_usuario: admin de empresa pode aplicar tipos DENTRO da própria
-- empresa (franquia e usuário-alvo têm que ser do mesmo tenant).
CREATE OR REPLACE FUNCTION public.aplicar_tipo_usuario(p_usuario uuid, p_franquia uuid, p_papel uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_cnt int; v_emp uuid;
BEGIN
  IF NOT auth_is_empresa_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem aplicar tipos de usuário.';
  END IF;
  IF p_franquia IS NULL THEN RAISE EXCEPTION 'Informe a franquia (unidade) do vínculo.'; END IF;
  IF NOT auth_is_superadmin() THEN
    SELECT empresa_id INTO v_emp FROM franquias WHERE id = p_franquia;
    IF v_emp IS DISTINCT FROM auth_empresa_id()
       OR (SELECT empresa_id FROM usuarios WHERE id = p_usuario) IS DISTINCT FROM auth_empresa_id() THEN
      RAISE EXCEPTION 'Fora do escopo da sua empresa.';
    END IF;
  END IF;

  INSERT INTO vinculos (usuario_id, franquia_id, area_id, papel_id, ativo)
  SELECT p_usuario, p_franquia, a.id, p_papel, true
  FROM papeis pp JOIN areas a ON a.codigo = ANY(pp.areas_padrao)
  WHERE pp.id = p_papel
    AND NOT EXISTS (
      SELECT 1 FROM vinculos v
       WHERE v.usuario_id = p_usuario AND v.franquia_id = p_franquia
         AND v.area_id = a.id AND v.papel_id = p_papel);
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  RETURN v_cnt;
END $$;
GRANT EXECUTE ON FUNCTION public.aplicar_tipo_usuario(uuid, uuid, uuid) TO authenticated;
