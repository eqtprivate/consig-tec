-- ============================================================
-- CONSIGTEC — Tipos de usuário: áreas padrão por papel + aplicação em massa.
-- Cada papel passa a ter um conjunto de áreas sugeridas; ao definir o "tipo"
-- de um usuário numa franquia, os vínculos das áreas do papel são criados de
-- uma vez. Após 0043. Idempotente.
-- ============================================================

ALTER TABLE papeis ADD COLUMN IF NOT EXISTS areas_padrao text[] DEFAULT '{}';

-- Áreas padrão por papel (códigos de areas). Só define quando ainda vazio,
-- para não sobrescrever ajustes manuais do admin.
UPDATE papeis SET areas_padrao = v.areas
FROM (VALUES
  ('admin_sistema',    ARRAY['convenios','crm','averbacao','formalizacao','financeiro','comissoes','cobranca','cessao_fidc','juridico','suporte','admin']),
  ('admin_diretoria',  ARRAY['convenios','crm','averbacao','formalizacao','financeiro','comissoes','cobranca','cessao_fidc','juridico','suporte','admin']),
  ('diretor_area',     ARRAY['convenios','crm','averbacao','formalizacao','financeiro','comissoes','cobranca','suporte']),
  ('gestor_area',      ARRAY['crm','averbacao','formalizacao','financeiro','comissoes','cobranca','suporte']),
  ('lider',            ARRAY['crm','averbacao','suporte']),
  ('operador',         ARRAY['crm','suporte']),
  ('backoffice',       ARRAY['averbacao','formalizacao','financeiro','suporte']),
  ('corban',           ARRAY['crm','suporte']),
  ('parceiro_externo', ARRAY['crm'])
) AS v(codigo, areas)
WHERE papeis.codigo = v.codigo
  AND (papeis.areas_padrao IS NULL OR array_length(papeis.areas_padrao, 1) IS NULL);

-- ------------------------------------------------------------
-- Aplica o "tipo" (papel) a um usuário numa franquia: cria os vínculos das
-- áreas padrão do papel que ainda não existirem. Retorna quantos criou.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aplicar_tipo_usuario(p_usuario uuid, p_franquia uuid, p_papel uuid)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_cnt int;
BEGIN
  IF NOT (auth_is_grupo_admin() OR auth_is_superadmin()) THEN
    RAISE EXCEPTION 'Apenas administradores podem aplicar tipos de usuário.';
  END IF;
  IF p_franquia IS NULL THEN
    RAISE EXCEPTION 'Informe a franquia (unidade) do vínculo.';
  END IF;

  INSERT INTO vinculos (usuario_id, franquia_id, area_id, papel_id, ativo)
  SELECT p_usuario, p_franquia, a.id, p_papel, true
  FROM papeis pp
  JOIN areas a ON a.codigo = ANY(pp.areas_padrao)
  WHERE pp.id = p_papel
    AND NOT EXISTS (
      SELECT 1 FROM vinculos v
       WHERE v.usuario_id = p_usuario AND v.franquia_id = p_franquia
         AND v.area_id = a.id AND v.papel_id = p_papel
    );
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  RETURN v_cnt;
END $$;
GRANT EXECUTE ON FUNCTION public.aplicar_tipo_usuario(uuid, uuid, uuid) TO authenticated;
