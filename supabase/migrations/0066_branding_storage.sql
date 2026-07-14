-- ============================================================
-- CONSIGTEC — Storage para logomarcas (white-label): bucket público 'branding'.
-- Upload restrito a admin/superadmin (auth_is_empresa_admin); leitura pública
-- (as logos aparecem na sidebar/login via <img src=URL pública>).
-- Caminho por empresa: branding/<empresa_id>/<variante>-<ts>.<ext>.
-- Após 0065. Idempotente.
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Leitura pública dos objetos do bucket.
DROP POLICY IF EXISTS branding_read ON storage.objects;
CREATE POLICY branding_read ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'branding');

-- Escrita/alteração/remoção: apenas admin da empresa ou superadmin.
DROP POLICY IF EXISTS branding_insert ON storage.objects;
CREATE POLICY branding_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branding' AND auth_is_empresa_admin());

DROP POLICY IF EXISTS branding_update ON storage.objects;
CREATE POLICY branding_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'branding' AND auth_is_empresa_admin())
  WITH CHECK (bucket_id = 'branding' AND auth_is_empresa_admin());

DROP POLICY IF EXISTS branding_delete ON storage.objects;
CREATE POLICY branding_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'branding' AND auth_is_empresa_admin());
