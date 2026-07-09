-- ============================================================
-- CONSIGTEC — Gestão de acessos: senha temporária / troca obrigatória
-- Aplicar após 0003. Idempotente.
-- ============================================================

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- Permite ao próprio usuário marcar que já trocou a senha temporária,
-- sem precisar de política de UPDATE ampla (que exporia outras colunas).
CREATE OR REPLACE FUNCTION public.marcar_senha_trocada()
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = 'public'
AS $$
  UPDATE public.usuarios SET must_change_password = false WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.marcar_senha_trocada() TO authenticated;
