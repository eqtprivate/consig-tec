-- ============================================================
-- CONSIGTEC — Personalização por empresa (white-label): cor + logomarca.
-- Cada cliente pode definir a própria cor primária e o logo. A escrita direta
-- em empresas é superadmin (empresas_admin); para permitir que o ADMIN da
-- empresa personalize SEM poder tocar plano/limite, expomos uma RPC SECURITY
-- DEFINER que grava apenas cor_primaria/logo_url do próprio tenant (ou de
-- qualquer um, se superadmin).
-- Após 0062. Idempotente.
-- ============================================================

ALTER TABLE empresas ADD COLUMN IF NOT EXISTS cor_primaria text; -- hex #RRGGBB
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS logo_url text;

CREATE OR REPLACE FUNCTION public.atualizar_branding_empresa(p_empresa uuid DEFAULT NULL, p_cor text DEFAULT NULL, p_logo text DEFAULT NULL)
RETURNS empresas
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

  -- Cor: aceita #RGB/#RRGGBB ou vazio (limpa). Validação leve.
  IF p_cor IS NOT NULL AND btrim(p_cor) <> '' AND btrim(p_cor) !~ '^#?[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$' THEN
    RAISE EXCEPTION 'Cor inválida (use hexadecimal, ex.: #2E4053).';
  END IF;

  UPDATE empresas
     SET cor_primaria = nullif(btrim(coalesce(p_cor, '')), ''),
         logo_url     = nullif(btrim(coalesce(p_logo, '')), ''),
         updated_at   = now()
   WHERE id = alvo
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Empresa não encontrada.'; END IF;
  RETURN v_row;
END $$;
GRANT EXECUTE ON FUNCTION public.atualizar_branding_empresa(uuid, text, text) TO authenticated;
