-- ============================================================
-- CONSIGTEC — Roles de usuário (usuario / admin / superadmin)
-- Aplicar após schema.sql. Idempotente.
-- ============================================================

DO $$ BEGIN
  CREATE TYPE role_usuario AS ENUM ('usuario', 'admin', 'superadmin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS role role_usuario NOT NULL DEFAULT 'usuario';

-- Backfill: quem já era admin do grupo vira superadmin
UPDATE public.usuarios SET role = 'superadmin'
WHERE is_grupo_admin = true AND role = 'usuario';

-- Mantém is_grupo_admin coerente com role (compatibilidade)
UPDATE public.usuarios SET is_grupo_admin = (role IN ('admin', 'superadmin'));

-- auth_is_grupo_admin passa a considerar role (admin OU superadmin)
CREATE OR REPLACE FUNCTION public.auth_is_grupo_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT coalesce((SELECT role IN ('admin', 'superadmin') FROM usuarios WHERE id = auth.uid()), false);
$$;

-- Novo helper: usuário é superadmin?
CREATE OR REPLACE FUNCTION public.auth_is_superadmin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT coalesce((SELECT role = 'superadmin' FROM usuarios WHERE id = auth.uid()), false);
$$;
