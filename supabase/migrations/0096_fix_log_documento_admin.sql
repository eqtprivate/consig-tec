-- ============================================================
-- CONSIGTEC — Correção: get_documento_admin gravava a trilha via
-- registrar_log_acesso (que insere ator_id/evento/detalhe), mas a tabela
-- logs_acesso EM PRODUÇÃO tem (usuario_id, acao, entidade, registro_id, ip).
-- Aqui a leitura auditada passa a inserir DIRETO em logs_acesso com as colunas
-- reais, e de forma DEFENSIVA: qualquer falha de log NÃO bloqueia a leitura do
-- documento. Após 0095. Idempotente (CREATE OR REPLACE).
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_documento_admin(p_id uuid)
RETURNS documentos_admin
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE d documentos_admin;
BEGIN
  IF NOT auth_is_superadmin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT * INTO d FROM documentos_admin WHERE id = p_id;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Documento não encontrado.'; END IF;
  -- Trilha de acesso (append-only). Best-effort: nunca derruba a leitura.
  BEGIN
    INSERT INTO logs_acesso (usuario_id, acao, entidade, registro_id)
    VALUES (auth.uid(), 'leitura_documento_admin', 'documentos_admin', p_id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN d;
END $$;
GRANT EXECUTE ON FUNCTION public.get_documento_admin(uuid) TO authenticated;
