-- 0105 — Exclusão SEGURA de empresa (tenant)
--
-- Excluir uma empresa é destrutivo: as FKs para empresas são majoritariamente
-- RESTRICT, então o Postgres já bloqueia apagar uma empresa COM dados. Esta RPC
-- torna isso explícito e amigável: superadmin apenas; recusa se houver qualquer
-- registro vinculado (listando onde), permitindo remover só empresas VAZIAS
-- (ex.: criadas por engano). Para empresas com dados, use "Arquivar" (ativo=false).

CREATE OR REPLACE FUNCTION public.excluir_empresa(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record; n bigint; total bigint := 0; detalhes text := '';
BEGIN
  IF NOT auth_is_superadmin() THEN RAISE EXCEPTION 'Apenas superadmin pode excluir empresas.'; END IF;
  IF p_id IS NULL THEN RAISE EXCEPTION 'Empresa inválida.'; END IF;
  IF p_id = auth_empresa_id() THEN RAISE EXCEPTION 'Não é possível excluir a empresa que você está usando.'; END IF;

  -- Conta dependentes em toda tabela do schema public que tenha coluna empresa_id.
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public' AND c.column_name = 'empresa_id' AND c.table_name <> 'empresas'
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE empresa_id = $1', r.table_name) INTO n USING p_id;
    IF n > 0 THEN total := total + n; detalhes := detalhes || format('%s (%s), ', r.table_name, n); END IF;
  END LOOP;

  IF total > 0 THEN
    RETURN jsonb_build_object(
      'ok', false, 'total', total, 'detalhes', rtrim(detalhes, ', '),
      'motivo', 'A empresa possui dados vinculados. Arquive (desative) em vez de excluir, ou remova os dados antes.');
  END IF;

  DELETE FROM public.empresas WHERE id = p_id;
  RETURN jsonb_build_object('ok', true);
END $$;

GRANT EXECUTE ON FUNCTION public.excluir_empresa(uuid) TO authenticated;
