-- ============================================================
-- CONSIGTEC — Ingestão e Leitura Automática de CCB. Recebe o PDF, extrai os
-- dados (Claude), faz matching (duplicata/completar/novo) e valida — mas NADA
-- é gravado sem aprovação humana. A aprovação cria CCB + contrato + parcelas.
-- Após 0077. Idempotente.
-- ============================================================

DO $$ BEGIN CREATE TYPE status_ingestao AS ENUM
  ('recebido', 'extraindo', 'aguardando_conferencia', 'aprovado', 'rejeitado', 'erro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE acao_ingestao AS ENUM
  ('completar_venda', 'novo_registro', 'duplicata');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS ingestoes_documento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES empresas(id),
  tipo_documento text NOT NULL DEFAULT 'ccb',
  arquivo_nome text,
  storage_path text,
  hash_sha256 text NOT NULL,
  drive_file_id text,
  drive_sincronizado_em timestamptz,
  status status_ingestao NOT NULL DEFAULT 'recebido',
  acao_sugerida acao_ingestao,
  acao_confirmada acao_ingestao,
  dados_extraidos jsonb,
  divergencias jsonb,
  confianca numeric(5,4),
  proposta_id uuid REFERENCES propostas(id) ON DELETE SET NULL,
  ccb_id uuid REFERENCES ccbs(id) ON DELETE SET NULL,
  enviado_por uuid REFERENCES usuarios(id),
  aprovado_por uuid REFERENCES usuarios(id),
  aprovado_em timestamptz,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- idempotência: um mesmo arquivo (hash) só entra uma vez por empresa
CREATE UNIQUE INDEX IF NOT EXISTS uq_ingestao_empresa_hash ON ingestoes_documento (empresa_id, hash_sha256);
CREATE INDEX IF NOT EXISTS idx_ingestao_status ON ingestoes_documento (empresa_id, status);

DROP TRIGGER IF EXISTS trg_ingestao_empresa ON ingestoes_documento;
CREATE TRIGGER trg_ingestao_empresa BEFORE INSERT ON ingestoes_documento FOR EACH ROW EXECUTE FUNCTION set_empresa_do_autor();
DROP TRIGGER IF EXISTS trg_ingestao_updated ON ingestoes_documento;
CREATE TRIGGER trg_ingestao_updated BEFORE UPDATE ON ingestoes_documento FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE ingestoes_documento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ingestao_rls ON ingestoes_documento;
CREATE POLICY ingestao_rls ON ingestoes_documento FOR ALL TO authenticated
  USING (auth_is_superadmin() OR empresa_id = auth_empresa_id())
  WITH CHECK (auth_is_superadmin() OR empresa_id = auth_empresa_id());

-- Bucket privado para os PDFs de CCB (acesso só via signed URL / service_role).
INSERT INTO storage.buckets (id, name, public) VALUES ('ccb-docs', 'ccb-docs', false)
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS ccbdocs_admin ON storage.objects;
CREATE POLICY ccbdocs_admin ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'ccb-docs' AND auth_is_empresa_admin())
  WITH CHECK (bucket_id = 'ccb-docs' AND auth_is_empresa_admin());

-- ============================================================
-- Aplicação atômica da ingestão aprovada: cria CCB (+ contrato + parcelas via
-- PMT) por 'completar_venda' (proposta existente) ou 'novo_registro' (cria
-- cliente + proposta). Abre pendência se houver divergência crítica justificada.
-- Chamada pela Edge Function aprovar_ingestao. SECURITY DEFINER.
-- ============================================================
CREATE OR REPLACE FUNCTION public.aplicar_ingestao_ccb(
  p_ingestao uuid,
  p_acao acao_ingestao,
  p_dados jsonb,
  p_justificativa text DEFAULT NULL,
  p_aprovador uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  ing        ingestoes_documento;
  v_cpf      text;
  v_cliente  uuid;
  v_prop     uuid;
  v_conv     uuid;
  v_num      text;
  v_princ    numeric;
  v_total    numeric;
  v_taxa     numeric;
  v_prazo    int;
  v_pmt      numeric;
  v_ccb      ccbs;
  v_area     uuid;
  v_tem_crit boolean;
BEGIN
  SELECT * INTO ing FROM ingestoes_documento WHERE id = p_ingestao;
  IF ing.id IS NULL THEN RAISE EXCEPTION 'Ingestão não encontrada.'; END IF;
  IF NOT (auth_is_superadmin() OR ing.empresa_id = auth_empresa_id()) THEN
    RAISE EXCEPTION 'Fora do escopo da sua empresa.';
  END IF;
  IF ing.status = 'aprovado' AND ing.ccb_id IS NOT NULL THEN
    RETURN ing.ccb_id; -- idempotente
  END IF;
  IF p_acao = 'duplicata' THEN
    RAISE EXCEPTION 'Duplicata não gera CCB.';
  END IF;

  -- Campos conferidos (p_dados é o que o operador confirmou/editou).
  v_cpf   := regexp_replace(coalesce(p_dados->>'cpf', ''), '\D', '', 'g');
  v_num   := nullif(p_dados->>'numero_ccb', '');
  v_princ := nullif(p_dados->>'valor_principal', '')::numeric;
  v_total := nullif(p_dados->>'valor_total', '')::numeric;
  v_taxa  := nullif(p_dados->>'taxa_mensal', '')::numeric;
  v_prazo := nullif(p_dados->>'prazo', '')::int;

  IF p_acao = 'completar_venda' THEN
    IF ing.proposta_id IS NULL THEN RAISE EXCEPTION 'Sem proposta vinculada para completar a venda.'; END IF;
    v_prop := ing.proposta_id;
    SELECT cliente_id, convenio_id INTO v_cliente, v_conv FROM propostas WHERE id = v_prop;
  ELSE
    -- novo_registro: encontra/cria cliente por CPF e cria a proposta (aprovada)
    IF v_cpf = '' THEN RAISE EXCEPTION 'CPF é obrigatório para novo registro.'; END IF;
    SELECT id INTO v_cliente FROM clientes WHERE regexp_replace(cpf, '\D', '', 'g') = v_cpf LIMIT 1;
    IF v_cliente IS NULL THEN
      INSERT INTO clientes (cpf, nome, empresa_id)
      VALUES (v_cpf, coalesce(nullif(p_dados->>'nome_cliente', ''), 'Cliente ' || left(v_cpf, 6)), ing.empresa_id)
      RETURNING id INTO v_cliente;
    END IF;
    INSERT INTO propostas (cliente_id, empresa_id, valor_solicitado, prazo, taxa_mensal, valor_parcela, status)
    VALUES (v_cliente, ing.empresa_id, coalesce(v_princ, 0), coalesce(v_prazo, 0), v_taxa,
            nullif(p_dados->>'valor_parcela', '')::numeric, 'aprovada')
    RETURNING id INTO v_prop;
  END IF;

  v_pmt := nullif(p_dados->>'valor_parcela', '')::numeric;

  -- Cria a CCB (assinada) ligada à proposta; gera o contrato + parcelas (PMT).
  INSERT INTO ccbs (numero, proposta_id, valor_principal, valor_total, taxa_mensal, prazo,
                    status, provider, assinada_em, observacao)
  VALUES (v_num, v_prop, v_princ, v_total, v_taxa, v_prazo,
          'assinada', 'ingestao', now(), 'Criada por ingestão automática de CCB')
  RETURNING * INTO v_ccb;

  PERFORM gerar_contrato_de_ccb(v_ccb.id); -- idempotente: cria contrato + cronograma

  -- Pendência quando há divergência crítica aceita com justificativa.
  v_tem_crit := EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(ing.divergencias, '[]'::jsonb)) d
                        WHERE d->>'tipo' = 'critica');
  IF v_tem_crit AND coalesce(btrim(p_justificativa), '') <> '' THEN
    SELECT id INTO v_area FROM areas WHERE codigo IN ('formalizacao', 'juridico') ORDER BY (codigo = 'formalizacao') DESC LIMIT 1;
    IF v_area IS NULL THEN SELECT id INTO v_area FROM areas LIMIT 1; END IF;
    IF v_area IS NOT NULL THEN
      INSERT INTO pendencias (titulo, descricao, origem, empresa_id, area_id, prioridade, status)
      VALUES ('CCB ' || coalesce(v_num, '') || ' aprovada com divergência',
              'Ingestão ' || p_ingestao::text || ' aprovada com divergência crítica. Justificativa: ' || p_justificativa,
              'ingestao_ccb', ing.empresa_id, v_area, 'alta', 'aberta');
    END IF;
  END IF;

  UPDATE ingestoes_documento
     SET status = 'aprovado', acao_confirmada = p_acao, proposta_id = v_prop, ccb_id = v_ccb.id,
         aprovado_por = coalesce(p_aprovador, auth.uid()), aprovado_em = now()
   WHERE id = p_ingestao;

  INSERT INTO auditoria (entidade, registro_id, acao, empresa_id, valor_novo)
  VALUES ('ingestoes_documento', p_ingestao, 'aprovar_ingestao_ccb', ing.empresa_id,
          jsonb_build_object('acao', p_acao, 'ccb_id', v_ccb.id, 'numero', v_num, 'justificativa', p_justificativa));

  RETURN v_ccb.id;
END $$;
GRANT EXECUTE ON FUNCTION public.aplicar_ingestao_ccb(uuid, acao_ingestao, jsonb, text, uuid) TO authenticated;
