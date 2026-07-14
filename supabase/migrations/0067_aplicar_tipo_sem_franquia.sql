-- ============================================================
-- CONSIGTEC — Vínculos por empresa sem exigir franquia. O conceito de unidade
-- (franquia) não é mais obrigatório: o acesso por ÁREA depende só do vínculo
-- (área×papel). aplicar_tipo_usuario passa a aceitar p_franquia NULL, validando
-- o escopo pela EMPRESA do usuário alvo (não pela franquia).
-- Após 0066. Idempotente (CREATE OR REPLACE mantém a assinatura).
-- ============================================================

CREATE OR REPLACE FUNCTION public.aplicar_tipo_usuario(p_usuario uuid, p_franquia uuid, p_papel uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_cnt int; v_emp_franq uuid; v_emp_user uuid;
BEGIN
  IF NOT auth_is_empresa_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem aplicar tipos de usuário.';
  END IF;

  SELECT empresa_id INTO v_emp_user FROM usuarios WHERE id = p_usuario;

  IF NOT auth_is_superadmin() THEN
    -- o alvo tem de ser da empresa do admin
    IF v_emp_user IS DISTINCT FROM auth_empresa_id() THEN
      RAISE EXCEPTION 'Fora do escopo da sua empresa.';
    END IF;
    -- se uma franquia foi informada, ela também precisa ser da empresa do admin
    IF p_franquia IS NOT NULL THEN
      SELECT empresa_id INTO v_emp_franq FROM franquias WHERE id = p_franquia;
      IF v_emp_franq IS DISTINCT FROM auth_empresa_id() THEN
        RAISE EXCEPTION 'Franquia fora da sua empresa.';
      END IF;
    END IF;
  END IF;

  INSERT INTO vinculos (usuario_id, franquia_id, area_id, papel_id, ativo)
  SELECT p_usuario, p_franquia, a.id, p_papel, true
  FROM papeis pp JOIN areas a ON a.codigo = ANY(pp.areas_padrao)
  WHERE pp.id = p_papel
    AND NOT EXISTS (
      SELECT 1 FROM vinculos v
       WHERE v.usuario_id = p_usuario
         AND v.franquia_id IS NOT DISTINCT FROM p_franquia   -- trata NULL corretamente
         AND v.area_id = a.id AND v.papel_id = p_papel);
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  RETURN v_cnt;
END $$;
GRANT EXECUTE ON FUNCTION public.aplicar_tipo_usuario(uuid, uuid, uuid) TO authenticated;
