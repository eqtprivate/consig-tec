-- ============================================================
-- CONSIGTEC — Persistir os dados ricos da CCB na aprovação.
-- 1) Colunas novas em clientes (pessoa/endereço) e em ccbs (financeiro/partes)
--    + ccbs.dados_extraidos (jsonb integral da leitura).
-- 2) Helpers tolerantes num_br() e parse_data_br().
-- 3) enriquecer_ccb_dados(p_ccb, p_dados): preenche as colunas e o jsonb após a
--    CCB ser criada (chamado pelo edge aprovar_ingestao). Aditivo — NÃO altera
--    aplicar_ingestao_ccb. COALESCE preserva dados já existentes do cliente.
-- Idempotente.
-- ============================================================

-- 1) Colunas -------------------------------------------------------------
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS rg              text,
  ADD COLUMN IF NOT EXISTS orgao_expedidor text,
  ADD COLUMN IF NOT EXISTS estado_civil    text,
  ADD COLUMN IF NOT EXISTS nacionalidade   text,
  ADD COLUMN IF NOT EXISTS naturalidade    text,
  ADD COLUMN IF NOT EXISTS profissao       text,
  ADD COLUMN IF NOT EXISTS endereco        text,
  ADD COLUMN IF NOT EXISTS numero_endereco text,
  ADD COLUMN IF NOT EXISTS complemento     text,
  ADD COLUMN IF NOT EXISTS bairro          text,
  ADD COLUMN IF NOT EXISTS cidade          text,
  ADD COLUMN IF NOT EXISTS uf              text,
  ADD COLUMN IF NOT EXISTS cep             text;

ALTER TABLE ccbs
  ADD COLUMN IF NOT EXISTS modalidade          text,
  ADD COLUMN IF NOT EXISTS praca_pagamento     text,
  ADD COLUMN IF NOT EXISTS valor_liberado      numeric(12,2),
  ADD COLUMN IF NOT EXISTS taxa_anual          numeric(10,4),
  ADD COLUMN IF NOT EXISTS cet_mensal          numeric(10,4),
  ADD COLUMN IF NOT EXISTS cet_anual           numeric(10,4),
  ADD COLUMN IF NOT EXISTS iof                 numeric(12,2),
  ADD COLUMN IF NOT EXISTS tarifa_cadastro     numeric(12,2),
  ADD COLUMN IF NOT EXISTS primeiro_vencimento date,
  ADD COLUMN IF NOT EXISTS ultimo_vencimento   date,
  ADD COLUMN IF NOT EXISTS credor_nome         text,
  ADD COLUMN IF NOT EXISTS credor_cnpj         text,
  ADD COLUMN IF NOT EXISTS correspondente_nome text,
  ADD COLUMN IF NOT EXISTS correspondente_cnpj text,
  ADD COLUMN IF NOT EXISTS banco_credito       text,
  ADD COLUMN IF NOT EXISTS agencia_credito     text,
  ADD COLUMN IF NOT EXISTS conta_credito       text,
  ADD COLUMN IF NOT EXISTS tipo_conta          text,
  ADD COLUMN IF NOT EXISTS dados_extraidos     jsonb;

-- 2) Helpers tolerantes --------------------------------------------------
CREATE OR REPLACE FUNCTION public.num_br(p text) RETURNS numeric
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE s text;
BEGIN
  IF p IS NULL OR btrim(p) = '' THEN RETURN NULL; END IF;
  s := regexp_replace(p, '[^0-9,.-]', '', 'g');
  IF position(',' IN s) > 0 THEN s := replace(replace(s, '.', ''), ',', '.'); END IF;
  RETURN s::numeric;
EXCEPTION WHEN others THEN RETURN NULL;
END; $$;

CREATE OR REPLACE FUNCTION public.parse_data_br(p text) RETURNS date
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p IS NULL OR btrim(p) = '' THEN RETURN NULL; END IF;
  IF p ~ '^\d{4}-\d{2}-\d{2}' THEN RETURN to_date(substring(p, 1, 10), 'YYYY-MM-DD'); END IF;
  IF p ~ '^\d{2}/\d{2}/\d{4}' THEN RETURN to_date(substring(p, 1, 10), 'DD/MM/YYYY'); END IF;
  RETURN NULL;
EXCEPTION WHEN others THEN RETURN NULL;
END; $$;

-- 3) Enriquecimento pós-aprovação ---------------------------------------
CREATE OR REPLACE FUNCTION public.enriquecer_ccb_dados(p_ccb uuid, p_dados jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_emp uuid; v_cliente uuid;
BEGIN
  IF p_ccb IS NULL OR p_dados IS NULL THEN RETURN; END IF;
  SELECT p.empresa_id, p.cliente_id INTO v_emp, v_cliente
    FROM ccbs c LEFT JOIN propostas p ON p.id = c.proposta_id
   WHERE c.id = p_ccb;
  -- fora do escopo → aborta (não vaza entre empresas)
  IF v_emp IS NOT NULL AND NOT (auth_is_superadmin() OR v_emp = auth_empresa_id()) THEN
    RAISE EXCEPTION 'Fora do escopo da sua empresa.';
  END IF;

  UPDATE ccbs SET
    modalidade          = nullif(p_dados->>'modalidade', ''),
    praca_pagamento     = nullif(p_dados->>'praca_pagamento', ''),
    valor_liberado      = num_br(p_dados->>'valor_liberado'),
    taxa_anual          = num_br(p_dados->>'taxa_anual'),
    cet_mensal          = num_br(p_dados->>'cet_mensal'),
    cet_anual           = num_br(p_dados->>'cet_anual'),
    iof                 = num_br(p_dados->>'iof'),
    tarifa_cadastro     = num_br(p_dados->>'tarifa_cadastro'),
    primeiro_vencimento = parse_data_br(p_dados->>'primeiro_vencimento'),
    ultimo_vencimento   = parse_data_br(p_dados->>'ultimo_vencimento'),
    credor_nome         = nullif(p_dados->>'credor_nome', ''),
    credor_cnpj         = nullif(p_dados->>'credor_cnpj', ''),
    correspondente_nome = nullif(p_dados->>'correspondente_nome', ''),
    correspondente_cnpj = nullif(p_dados->>'correspondente_cnpj', ''),
    banco_credito       = nullif(p_dados->>'banco_credito', ''),
    agencia_credito     = nullif(p_dados->>'agencia_credito', ''),
    conta_credito       = nullif(p_dados->>'conta_credito', ''),
    tipo_conta          = nullif(p_dados->>'tipo_conta', ''),
    dados_extraidos     = p_dados,
    updated_at          = now()
  WHERE id = p_ccb;

  -- Cliente: preenche apenas o que estiver vazio (COALESCE preserva o atual).
  IF v_cliente IS NOT NULL THEN
    UPDATE clientes SET
      data_nascimento = COALESCE(data_nascimento, parse_data_br(p_dados->>'data_nascimento')),
      telefone        = COALESCE(telefone,        nullif(p_dados->>'telefone', '')),
      email           = COALESCE(email,           nullif(p_dados->>'email', '')),
      matricula       = COALESCE(matricula,        nullif(p_dados->>'matricula', '')),
      rg              = COALESCE(rg,               nullif(p_dados->>'rg', '')),
      orgao_expedidor = COALESCE(orgao_expedidor,  nullif(p_dados->>'orgao_expedidor', '')),
      estado_civil    = COALESCE(estado_civil,     nullif(p_dados->>'estado_civil', '')),
      nacionalidade   = COALESCE(nacionalidade,    nullif(p_dados->>'nacionalidade', '')),
      naturalidade    = COALESCE(naturalidade,     nullif(p_dados->>'naturalidade', '')),
      profissao       = COALESCE(profissao,        nullif(p_dados->>'profissao', '')),
      endereco        = COALESCE(endereco,         nullif(p_dados->>'endereco', '')),
      numero_endereco = COALESCE(numero_endereco,  nullif(p_dados->>'numero_endereco', '')),
      complemento     = COALESCE(complemento,      nullif(p_dados->>'complemento', '')),
      bairro          = COALESCE(bairro,           nullif(p_dados->>'bairro', '')),
      cidade          = COALESCE(cidade,           nullif(p_dados->>'cidade', '')),
      uf              = COALESCE(uf,               nullif(p_dados->>'uf', '')),
      cep             = COALESCE(cep,              nullif(p_dados->>'cep', '')),
      updated_at      = now()
    WHERE id = v_cliente;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.enriquecer_ccb_dados(uuid, jsonb) TO authenticated;
