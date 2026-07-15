-- ============================================================
-- CONSIGTEC — Arquivamento das CCBs.
-- Supabase Storage segue como hospedagem principal (bucket privado 'ccb-docs',
-- criptografado em repouso, acesso via URL assinada). Aqui só acrescentamos a
-- OPÇÃO de a empresa registrar uma pasta do Google Drive como destino alternativo
-- do espelho (espelhar_drive passa a usar a pasta da empresa quando ativa).
-- Idempotente.
-- ============================================================

ALTER TABLE config_ingestao_ccb
  ADD COLUMN IF NOT EXISTS drive_folder_id text,
  ADD COLUMN IF NOT EXISTS drive_ativo      boolean NOT NULL DEFAULT false;

-- RPC de gravação do arquivamento (upsert autorizado; cria a linha de config se
-- ainda não existir, herdando o modelo padrão).
CREATE OR REPLACE FUNCTION public.salvar_arquivamento_ccb(
  p_drive_folder_id text, p_drive_ativo boolean, p_empresa uuid DEFAULT NULL
) RETURNS config_ingestao_ccb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE emp uuid; linha config_ingestao_ccb;
BEGIN
  emp := auth_empresa_efetiva(p_empresa);
  IF emp IS NULL THEN RAISE EXCEPTION 'Empresa não resolvida (selecione uma empresa).'; END IF;
  IF NOT auth_is_empresa_admin() THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
  INSERT INTO config_ingestao_ccb (empresa_id, drive_folder_id, drive_ativo, atualizado_por, atualizado_em)
  VALUES (emp, nullif(btrim(p_drive_folder_id), ''), coalesce(p_drive_ativo, false), auth.uid(), now())
  ON CONFLICT (empresa_id) DO UPDATE
    SET drive_folder_id = nullif(btrim(p_drive_folder_id), ''),
        drive_ativo = coalesce(p_drive_ativo, false),
        atualizado_por = auth.uid(),
        atualizado_em = now()
  RETURNING * INTO linha;
  RETURN linha;
END; $$;
GRANT EXECUTE ON FUNCTION public.salvar_arquivamento_ccb(text, boolean, uuid) TO authenticated;
