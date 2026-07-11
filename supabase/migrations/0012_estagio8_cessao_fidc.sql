-- ============================================================
-- CONSIGTEC — Estágio 8: Cessão, Lastro & FIDC (multi-fundo)
-- Modelo de registro/conciliação da cessão de recebíveis próprios:
-- Gestoras, Administradoras, Fundos, Cedentes, Termos de Cessão,
-- Itens (título→CCB), Dados de Depósito, Assinaturas (Clicksign) e PDD.
-- Camada financeira do grupo → leitura autenticada, escrita admin.
-- Aplicar após 0011. Idempotente.
-- ============================================================

DO $$ BEGIN CREATE TYPE status_cessao AS ENUM
  ('rascunho','assinada','integrada','conciliada','cancelada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS gestoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL, cnpj text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS administradoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL, cnpj text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cedentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL, cnpj text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS fundos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL, cnpj text,
  gestora_id uuid REFERENCES gestoras(id),
  administradora_id uuid REFERENCES administradoras(id),
  tipo text,                              -- FIDC, securitizadora...
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS termos_cessao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referencia text,                        -- nº/ref do contrato de cessão
  fundo_id uuid REFERENCES fundos(id),
  cedente_id uuid REFERENCES cedentes(id),
  data_cessao date,
  valor_total numeric(14,2),
  sem_coobrigacao boolean NOT NULL DEFAULT true,   -- cessão sem regresso
  foro text,
  status status_cessao NOT NULL DEFAULT 'rascunho',
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_termos_fundo ON termos_cessao(fundo_id);

CREATE TABLE IF NOT EXISTS itens_cessao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  termo_id uuid NOT NULL REFERENCES termos_cessao(id) ON DELETE CASCADE,
  ccb_id uuid REFERENCES ccbs(id),
  titulo text,                            -- nº do título (casa com CCB.numero)
  emitente text, cpf_cnpj text,
  vencimento date, valor numeric(14,2), agio_desagio numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_itens_termo ON itens_cessao(termo_id);
CREATE INDEX IF NOT EXISTS idx_itens_ccb ON itens_cessao(ccb_id);

CREATE TABLE IF NOT EXISTS dados_deposito_cessao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  termo_id uuid NOT NULL REFERENCES termos_cessao(id) ON DELETE CASCADE,
  banco text, agencia text, conta text, cnpj text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assinaturas_cessao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  termo_id uuid NOT NULL REFERENCES termos_cessao(id) ON DELETE CASCADE,
  documento_numero text,
  hash_original text, hash_pades text,
  signatario text, papel text, cpf text,
  tipo_certificado text,                  -- ICP-Brasil A1/A3, token e-mail
  ip text, geolocalizacao text,
  assinado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assinaturas_termo ON assinaturas_cessao(termo_id);

CREATE TABLE IF NOT EXISTS pdd_carteira (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fundo_id uuid REFERENCES fundos(id),
  competencia text NOT NULL,              -- 'YYYY-MM'
  saldo_carteira numeric(16,2),
  pdd_valor numeric(16,2),
  pdd_percentual numeric(6,4),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fundo_id, competencia)
);

-- triggers updated_at (nas que têm a coluna)
DROP TRIGGER IF EXISTS trg_fundos_updated ON fundos;
CREATE TRIGGER trg_fundos_updated BEFORE UPDATE ON fundos FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_termos_updated ON termos_cessao;
CREATE TRIGGER trg_termos_updated BEFORE UPDATE ON termos_cessao FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS: leitura para autenticados, escrita para admin do grupo
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['gestoras','administradoras','cedentes','fundos','termos_cessao','itens_cessao','dados_deposito_cessao','assinaturas_cessao','pdd_carteira']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_read ON %I', t, t);
    EXECUTE format('CREATE POLICY %I_read ON %I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_admin ON %I', t, t);
    EXECUTE format('CREATE POLICY %I_admin ON %I FOR ALL TO authenticated USING (auth_is_grupo_admin()) WITH CHECK (auth_is_grupo_admin())', t, t);
  END LOOP;
END $$;
