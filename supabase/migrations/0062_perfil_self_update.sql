-- ============================================================
-- CONSIGTEC — Edição do PRÓPRIO perfil (qualquer usuário logado).
-- A policy usuarios_update só permite superadmin/admin; um 'usuario' comum não
-- consegue editar a própria linha. Em vez de afrouxar a RLS por coluna (o que
-- exporia role/empresa_id/ativo a auto-promoção), expomos uma RPC SECURITY
-- DEFINER que atualiza APENAS campos de perfil (nome/telefone/cpf) do auth.uid().
-- Após 0061. Idempotente.
-- ============================================================

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefone text;

CREATE OR REPLACE FUNCTION public.atualizar_meu_perfil(p_nome text, p_telefone text DEFAULT NULL, p_cpf text DEFAULT NULL)
RETURNS usuarios
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_row usuarios;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF coalesce(btrim(p_nome), '') = '' THEN RAISE EXCEPTION 'O nome é obrigatório.'; END IF;

  UPDATE usuarios
     SET nome = btrim(p_nome),
         telefone = nullif(btrim(coalesce(p_telefone, '')), ''),
         cpf = nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), ''),
         updated_at = now()
   WHERE id = auth.uid()
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado.'; END IF;
  RETURN v_row;  -- role/empresa_id/ativo NÃO são tocados (segurança)
END $$;
GRANT EXECUTE ON FUNCTION public.atualizar_meu_perfil(text, text, text) TO authenticated;
