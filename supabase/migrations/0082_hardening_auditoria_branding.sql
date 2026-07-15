-- ============================================================
-- CONSIGTEC — Hardening de seguranca (Item 1 / advisors do Supabase).
-- 1) auditoria: INSERT deixa de ser WITH CHECK(true). Passa a exigir que a linha
--    seja atribuida ao proprio autor (usuario_id = auth.uid()), impedindo forjar
--    trilha em nome de terceiros. RPCs SECURITY DEFINER seguem inalteradas
--    (bypassam RLS). O client ja insere com usuario_id = user.id.
-- 2) storage/branding: remove a policy de SELECT ampla que permitia LISTAR todos
--    os arquivos do bucket publico. O acesso por URL publica (logos) nao depende
--    dessa policy e continua funcionando; o app nunca lista o bucket.
-- Apos 0081. Idempotente.
-- ============================================================

-- (1) auditoria
DROP POLICY IF EXISTS audit_insert ON public.auditoria;
CREATE POLICY audit_insert ON public.auditoria FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid());

-- (2) branding: sem listagem (bucket publico serve por URL sem policy)
DROP POLICY IF EXISTS branding_read ON storage.objects;
