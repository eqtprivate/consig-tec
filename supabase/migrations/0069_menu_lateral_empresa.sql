-- ============================================================
-- CONSIGTEC — Menu lateral configurável POR EMPRESA. O admin reorganiza os
-- grupos e as páginas (ordem + mostrar/ocultar). Guardado em empresas.menu_config
-- (jsonb) e aplicado no Sidebar. RPC SECURITY DEFINER: admin edita a própria
-- empresa; superadmin edita qualquer uma. Após 0068. Idempotente.
--
-- Formato:
--   { "grupos":  [ {"key":"dashboard","oculto":false}, {"key":"area:crm",...} ],
--     "paginas": { "area:crm": [ {"key":"leads","oculto":false}, ... ] } }
-- ============================================================

ALTER TABLE empresas ADD COLUMN IF NOT EXISTS menu_config jsonb;

CREATE OR REPLACE FUNCTION public.atualizar_menu_empresa(p_empresa uuid DEFAULT NULL, p_config jsonb DEFAULT NULL)
RETURNS empresas
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE alvo uuid; v_row empresas;
BEGIN
  IF auth_is_superadmin() THEN
    alvo := coalesce(p_empresa, auth_empresa_id());
  ELSIF auth_is_empresa_admin() THEN
    alvo := auth_empresa_id();
  ELSE
    RAISE EXCEPTION 'Sem permissão para configurar o menu.';
  END IF;
  IF alvo IS NULL THEN RAISE EXCEPTION 'Empresa não resolvida.'; END IF;

  UPDATE empresas SET menu_config = p_config, updated_at = now()
   WHERE id = alvo
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Empresa não encontrada.'; END IF;
  RETURN v_row;
END $$;
GRANT EXECUTE ON FUNCTION public.atualizar_menu_empresa(uuid, jsonb) TO authenticated;
