-- ============================================================
-- CONSIGTEC — White-label v2: KITS de cores (tema) + logomarca clara/escura.
-- Em vez de só a cor primária, a empresa escolhe um TEMA (kit) que altera todo
-- o layout (primária, sidebar, realces). Guarda também duas logos: uma para
-- fundos claros e outra para fundos escuros (a sidebar é escura).
-- Após 0064. Idempotente. Recria a RPC (nova assinatura → DROP + CREATE).
-- ============================================================

ALTER TABLE empresas ADD COLUMN IF NOT EXISTS tema text;          -- chave do kit de cores
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS logo_url_dark text; -- logo p/ fundos escuros (sidebar)

DROP FUNCTION IF EXISTS public.atualizar_branding_empresa(uuid, text, text);

CREATE OR REPLACE FUNCTION public.atualizar_branding_empresa(
  p_empresa uuid DEFAULT NULL,
  p_tema text DEFAULT NULL,
  p_cor text DEFAULT NULL,
  p_logo text DEFAULT NULL,
  p_logo_dark text DEFAULT NULL
) RETURNS empresas
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE alvo uuid; v_row empresas;
BEGIN
  IF auth_is_superadmin() THEN
    alvo := coalesce(p_empresa, auth_empresa_id());
  ELSIF auth_is_empresa_admin() THEN
    alvo := auth_empresa_id();               -- admin comum: só a própria empresa
  ELSE
    RAISE EXCEPTION 'Sem permissão para personalizar a empresa.';
  END IF;
  IF alvo IS NULL THEN RAISE EXCEPTION 'Empresa não resolvida.'; END IF;

  IF p_cor IS NOT NULL AND btrim(p_cor) <> '' AND btrim(p_cor) !~ '^#?[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$' THEN
    RAISE EXCEPTION 'Cor inválida (use hexadecimal, ex.: #2E4053).';
  END IF;

  UPDATE empresas
     SET tema          = nullif(btrim(coalesce(p_tema, '')), ''),
         cor_primaria  = nullif(btrim(coalesce(p_cor, '')), ''),
         logo_url      = nullif(btrim(coalesce(p_logo, '')), ''),
         logo_url_dark = nullif(btrim(coalesce(p_logo_dark, '')), ''),
         updated_at    = now()
   WHERE id = alvo
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Empresa não encontrada.'; END IF;
  RETURN v_row;
END $$;
GRANT EXECUTE ON FUNCTION public.atualizar_branding_empresa(uuid, text, text, text, text) TO authenticated;
