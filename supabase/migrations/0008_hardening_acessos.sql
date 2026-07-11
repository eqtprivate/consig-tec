-- ============================================================
-- CONSIGTEC — Hardening de acessos (segurança)
-- Corrige escalonamento de privilégio: a policy antiga
-- `usuarios_admin` (FOR ALL a qualquer grupo_admin) permitia que um
-- ADMIN comum alterasse a própria linha em `usuarios` via API direta
-- (PostgREST) e se promovesse a `superadmin`, driblando as travas das
-- funções backend. Aqui a escrita em `usuarios` passa a respeitar a
-- hierarquia: só superadmin cria/gera admins; admin só mexe em linhas
-- de papel 'usuario'.
-- Aplicar após 0004 (idealmente junto com as demais). Idempotente.
-- As funções backend (service_role) continuam funcionando: service_role
-- ignora RLS. O trigger handle_new_user (SECURITY DEFINER) também.
-- ============================================================

-- Remove a policy ampla FOR ALL
DROP POLICY IF EXISTS usuarios_admin ON usuarios;

-- SELECT continua via `usuarios_self` (id = auth.uid() OR auth_is_grupo_admin()).

-- INSERT direto por API: apenas superadmin. (Fluxo normal cria via função
-- backend com service_role, que ignora RLS.)
DROP POLICY IF EXISTS usuarios_insert ON usuarios;
CREATE POLICY usuarios_insert ON usuarios FOR INSERT TO authenticated
  WITH CHECK (auth_is_superadmin());

-- UPDATE: superadmin altera qualquer linha; admin comum só altera linhas
-- cujo papel é 'usuario' E não pode elevar o papel acima de 'usuario'
-- (o USING trava a linha-alvo; o WITH CHECK trava a linha resultante).
DROP POLICY IF EXISTS usuarios_update ON usuarios;
CREATE POLICY usuarios_update ON usuarios FOR UPDATE TO authenticated
  USING (auth_is_superadmin() OR (auth_is_grupo_admin() AND role = 'usuario'))
  WITH CHECK (auth_is_superadmin() OR (auth_is_grupo_admin() AND role = 'usuario'));

-- DELETE: superadmin qualquer; admin só usuário comum.
DROP POLICY IF EXISTS usuarios_delete ON usuarios;
CREATE POLICY usuarios_delete ON usuarios FOR DELETE TO authenticated
  USING (auth_is_superadmin() OR (auth_is_grupo_admin() AND role = 'usuario'));

-- ------------------------------------------------------------
-- Vínculos: criação/edição de vínculo com papel administrativo só por
-- superadmin (evita que admin conceda escopo 'admin*' a terceiros).
-- Admin comum ainda gerencia vínculos operacionais (papéis não-admin).
-- ------------------------------------------------------------
DROP POLICY IF EXISTS vinculos_admin ON vinculos;
CREATE POLICY vinculos_admin ON vinculos FOR ALL TO authenticated
  USING (
    auth_is_superadmin()
    OR (auth_is_grupo_admin() AND EXISTS (
      SELECT 1 FROM papeis p WHERE p.id = papel_id AND coalesce(p.codigo,'') NOT LIKE 'admin%'))
  )
  WITH CHECK (
    auth_is_superadmin()
    OR (auth_is_grupo_admin() AND EXISTS (
      SELECT 1 FROM papeis p WHERE p.id = papel_id AND coalesce(p.codigo,'') NOT LIKE 'admin%'))
  );
