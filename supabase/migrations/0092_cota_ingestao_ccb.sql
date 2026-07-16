-- ============================================================
-- CONSIGTEC — Cota/metering de leitura de CCB por plano (pacote da empresa).
-- Acrescenta limites de leituras/mês, armazenamento (MB) e documentos totais ao
-- plano; grava o tamanho do PDF; e cria a RPC de uso+cota usada tanto pela UI
-- quanto pelo gate do ingerir_ccb (bloqueia ao exceder). Superadmin e empresa
-- sem plano nunca bloqueiam. Idempotente. Após 0089/0090/0091.
-- ============================================================

-- 1) Limites no plano + tamanho do arquivo ------------------------------
ALTER TABLE planos
  ADD COLUMN IF NOT EXISTS limite_leituras_ccb_mes int,   -- NULL = ilimitado
  ADD COLUMN IF NOT EXISTS limite_armazenamento_mb int,   -- NULL = ilimitado
  ADD COLUMN IF NOT EXISTS limite_documentos int;         -- NULL = ilimitado

ALTER TABLE ingestoes_documento ADD COLUMN IF NOT EXISTS tamanho_bytes bigint;

-- 2) Uso + cota por empresa (UI e gate) ---------------------------------
CREATE OR REPLACE FUNCTION public.uso_ingestao_empresa(p_empresa uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  emp uuid; pl planos; sup boolean := auth_is_superadmin();
  v_leit int; v_docs int; v_mb numeric; v_tok bigint; v_custo numeric;
  lim_leit int; lim_mb int; lim_docs int;
  bloqueia boolean := false; motivo text := null;
BEGIN
  emp := auth_empresa_efetiva(p_empresa);
  IF emp IS NULL THEN RETURN jsonb_build_object('bloqueia', false); END IF;

  SELECT p.* INTO pl FROM planos p JOIN empresas e ON e.plano_id = p.id WHERE e.id = emp;

  SELECT count(*) INTO v_leit FROM ingestoes_documento
    WHERE empresa_id = emp AND created_at >= date_trunc('month', now());
  SELECT count(*) INTO v_docs FROM ingestoes_documento
    WHERE empresa_id = emp AND status <> 'rejeitado';
  SELECT round(coalesce(sum(tamanho_bytes), 0) / 1048576.0, 1) INTO v_mb FROM ingestoes_documento
    WHERE empresa_id = emp;
  SELECT coalesce(sum(coalesce(tokens_entrada,0) + coalesce(tokens_saida,0)), 0),
         coalesce(sum(custo_usd), 0)
    INTO v_tok, v_custo FROM ingestao_tentativas
    WHERE empresa_id = emp AND created_at >= date_trunc('month', now());

  lim_leit := pl.limite_leituras_ccb_mes; lim_mb := pl.limite_armazenamento_mb; lim_docs := pl.limite_documentos;

  IF NOT sup AND pl.id IS NOT NULL THEN
    IF lim_leit IS NOT NULL AND v_leit >= lim_leit THEN
      bloqueia := true; motivo := format('Limite de leituras de CCB do mês atingido (%s/%s).', v_leit, lim_leit);
    ELSIF lim_docs IS NOT NULL AND v_docs >= lim_docs THEN
      bloqueia := true; motivo := format('Limite de documentos do plano atingido (%s/%s).', v_docs, lim_docs);
    ELSIF lim_mb IS NOT NULL AND v_mb >= lim_mb THEN
      bloqueia := true; motivo := format('Limite de armazenamento do plano atingido (%s/%s MB).', v_mb, lim_mb);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'bloqueia', bloqueia, 'motivo', motivo, 'plano_nome', pl.nome,
    'uso', jsonb_build_object('leituras_mes', v_leit, 'documentos', v_docs,
      'armazenamento_mb', v_mb, 'tokens_mes', v_tok, 'custo_mes', round(v_custo, 4)),
    'limites', jsonb_build_object('leituras_ccb_mes', lim_leit, 'documentos', lim_docs, 'armazenamento_mb', lim_mb)
  );
END $$;
GRANT EXECUTE ON FUNCTION public.uso_ingestao_empresa(uuid) TO authenticated;

-- 3) Recria plano_uso_empresa() incluindo os medidores de CCB (banner) ---
CREATE OR REPLACE FUNCTION public.plano_uso_empresa()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE emp uuid; v_plano jsonb; v_usuarios int; v_convenios int; v_propostas int;
        v_leit int; v_docs int; v_mb numeric;
BEGIN
  emp := auth_empresa_id();
  IF emp IS NULL THEN RETURN NULL; END IF;

  SELECT to_jsonb(p) INTO v_plano FROM planos p JOIN empresas e ON e.plano_id = p.id WHERE e.id = emp;
  SELECT count(*) INTO v_usuarios FROM usuarios WHERE empresa_id = emp;
  SELECT count(*) INTO v_convenios FROM convenios WHERE empresa_id = emp;
  SELECT count(*) INTO v_propostas FROM propostas WHERE empresa_id = emp AND created_at >= date_trunc('month', now());
  SELECT count(*) INTO v_leit FROM ingestoes_documento WHERE empresa_id = emp AND created_at >= date_trunc('month', now());
  SELECT count(*) INTO v_docs FROM ingestoes_documento WHERE empresa_id = emp AND status <> 'rejeitado';
  SELECT round(coalesce(sum(tamanho_bytes), 0) / 1048576.0, 1) INTO v_mb FROM ingestoes_documento WHERE empresa_id = emp;

  RETURN jsonb_build_object(
    'plano', v_plano,
    'uso', jsonb_build_object(
      'usuarios', v_usuarios, 'convenios', v_convenios, 'propostas_mes', v_propostas,
      'leituras_ccb_mes', v_leit, 'documentos', v_docs, 'armazenamento_mb', v_mb)
  );
END $$;
GRANT EXECUTE ON FUNCTION public.plano_uso_empresa() TO authenticated;

-- 4) Backfill (opcional, superadmin) — preenche tamanho dos PDFs já enviados
--    a partir de storage.objects (empresa_id é o 1º segmento do path).
CREATE OR REPLACE FUNCTION public.backfill_tamanho_ccb()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE n int := 0;
BEGIN
  IF NOT auth_is_superadmin() THEN RAISE EXCEPTION 'Somente superadmin.'; END IF;
  UPDATE ingestoes_documento i
     SET tamanho_bytes = (o.metadata->>'size')::bigint
    FROM storage.objects o
   WHERE o.bucket_id = 'ccb-docs' AND o.name = i.storage_path
     AND i.tamanho_bytes IS NULL AND (o.metadata->>'size') IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.backfill_tamanho_ccb() TO authenticated;
