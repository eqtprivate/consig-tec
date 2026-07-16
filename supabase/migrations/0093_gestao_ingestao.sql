-- ============================================================
-- CONSIGTEC — Gestão operacional da ingestão de CCB.
-- Exclusão autorizada (admin da empresa / superadmin) de tentativas do log e de
-- ingestões (NÃO permite excluir ingestão APROVADA / com CCB). Idempotente.
-- ============================================================

-- Exclui uma linha do log de tentativas.
CREATE OR REPLACE FUNCTION public.excluir_tentativa_ingestao(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE emp uuid;
BEGIN
  SELECT empresa_id INTO emp FROM ingestao_tentativas WHERE id = p_id;
  IF emp IS NULL THEN RETURN; END IF;
  IF NOT (auth_is_superadmin() OR (auth_is_empresa_admin() AND emp = auth_empresa_id())) THEN
    RAISE EXCEPTION 'Sem permissão.';
  END IF;
  DELETE FROM ingestao_tentativas WHERE id = p_id;
END $$;
GRANT EXECUTE ON FUNCTION public.excluir_tentativa_ingestao(uuid) TO authenticated;

-- Limpa TODO o log de tentativas da empresa efetiva (superadmin: p_empresa).
CREATE OR REPLACE FUNCTION public.limpar_tentativas_ingestao(p_empresa uuid DEFAULT NULL)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE emp uuid; n int;
BEGIN
  emp := auth_empresa_efetiva(p_empresa);
  IF emp IS NULL THEN RAISE EXCEPTION 'Empresa não resolvida (selecione uma empresa).'; END IF;
  IF NOT auth_is_empresa_admin() THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
  DELETE FROM ingestao_tentativas WHERE empresa_id = emp;
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.limpar_tentativas_ingestao(uuid) TO authenticated;

-- Exclui uma ingestão (documento) + suas tentativas. Bloqueia se já APROVADA
-- (virou CCB). Devolve o storage_path para o cliente apagar o PDF no Storage.
CREATE OR REPLACE FUNCTION public.excluir_ingestao(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE ing ingestoes_documento;
BEGIN
  SELECT * INTO ing FROM ingestoes_documento WHERE id = p_id;
  IF ing.id IS NULL THEN RAISE EXCEPTION 'Ingestão não encontrada.'; END IF;
  IF NOT (auth_is_superadmin() OR (auth_is_empresa_admin() AND ing.empresa_id = auth_empresa_id())) THEN
    RAISE EXCEPTION 'Sem permissão.';
  END IF;
  IF ing.status = 'aprovado' OR ing.ccb_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ingestão aprovada (com CCB) não pode ser excluída.';
  END IF;
  DELETE FROM ingestao_tentativas WHERE ingestao_id = p_id;
  DELETE FROM ingestoes_documento WHERE id = p_id;
  RETURN jsonb_build_object('storage_path', ing.storage_path);
END $$;
GRANT EXECUTE ON FUNCTION public.excluir_ingestao(uuid) TO authenticated;
