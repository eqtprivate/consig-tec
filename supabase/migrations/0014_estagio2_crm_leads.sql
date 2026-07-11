-- ============================================================
-- CONSIGTEC — Estágio 2: CRM (leads, funil, campanhas)
-- Pipeline comercial: captação de leads, funil por status e campanhas.
-- Aplicar após 0013. Idempotente.
-- ============================================================

DO $$ BEGIN CREATE TYPE status_lead AS ENUM
  ('novo','contatado','qualificado','convertido','perdido'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------
-- CAMPANHAS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  canal text,                              -- whatsapp, telemarketing, indicacao...
  franquia_id uuid REFERENCES franquias(id),
  data_inicio date,
  data_fim date,
  meta_leads int,
  meta_valor numeric(14,2),
  ativo boolean NOT NULL DEFAULT true,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campanhas_franquia ON campanhas(franquia_id);

-- ------------------------------------------------------------
-- LEADS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  telefone text,
  email text,
  cpf text,
  origem text,                             -- campanha, indicacao, orgânico...
  campanha_id uuid REFERENCES campanhas(id),
  status status_lead NOT NULL DEFAULT 'novo',
  responsavel_id uuid REFERENCES usuarios(id),
  franquia_id uuid REFERENCES franquias(id),
  cliente_id uuid REFERENCES clientes(id), -- preenchido ao converter
  valor_estimado numeric(12,2),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_franquia ON leads(franquia_id);
CREATE INDEX IF NOT EXISTS idx_leads_campanha ON leads(campanha_id);

DROP TRIGGER IF EXISTS trg_campanhas_updated ON campanhas;
CREATE TRIGGER trg_campanhas_updated BEFORE UPDATE ON campanhas FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_leads_updated ON leads;
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS: escopo por franquia (ou admin do grupo)
ALTER TABLE campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campanhas_rls ON campanhas;
CREATE POLICY campanhas_rls ON campanhas FOR ALL TO authenticated
  USING (auth_is_grupo_admin() OR auth_tem_escopo(NULL, franquia_id))
  WITH CHECK (auth_is_grupo_admin() OR auth_tem_escopo(NULL, franquia_id));

DROP POLICY IF EXISTS leads_rls ON leads;
CREATE POLICY leads_rls ON leads FOR ALL TO authenticated
  USING (auth_is_grupo_admin() OR auth_tem_escopo(NULL, franquia_id))
  WITH CHECK (auth_is_grupo_admin() OR auth_tem_escopo(NULL, franquia_id));
