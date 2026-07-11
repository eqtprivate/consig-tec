-- ============================================================
-- CONSIGTEC — Estágios 14–16: Carteiras adquiridas, Refinanciamento, Integrações
-- Aplicar após 0015. Idempotente.
-- ============================================================

DO $$ BEGIN CREATE TYPE status_carteira AS ENUM
  ('prospeccao','due_diligence','precificada','adquirida','descartada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE status_refin AS ENUM
  ('fila','simulado','aprovado','emitido','recusado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------- Carteiras adquiridas de terceiros (14) ----------------
CREATE TABLE IF NOT EXISTS carteiras_adquiridas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem text NOT NULL,                    -- cedente/originador da carteira
  valor_face numeric(16,2),
  valor_aquisicao numeric(16,2),
  desagio numeric(6,4),
  qtd_contratos int,
  status status_carteira NOT NULL DEFAULT 'prospeccao',
  data_referencia date,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------- Refinanciamento (15) ----------------
CREATE TABLE IF NOT EXISTS refinanciamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_original_id uuid REFERENCES contratos(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES clientes(id),
  nova_ccb_id uuid REFERENCES ccbs(id),
  valor_quitacao numeric(12,2),
  valor_novo numeric(12,2),
  troco numeric(12,2),
  status status_refin NOT NULL DEFAULT 'fila',
  franquia_id uuid REFERENCES franquias(id),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refin_status ON refinanciamentos(status);

-- ---------------- Integrações & Portais (16) ----------------
CREATE TABLE IF NOT EXISTS integracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,                      -- UY3, Kanastra, Utility, WhatsApp, Resend, PixConsig...
  tipo text,                               -- ccb, fidc, mensageria, notificacao, convenios
  status text NOT NULL DEFAULT 'inativo',  -- ativo | inativo | erro
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ultima_sincronizacao timestamptz,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nome)
);

DROP TRIGGER IF EXISTS trg_carteiras_updated ON carteiras_adquiridas;
CREATE TRIGGER trg_carteiras_updated BEFORE UPDATE ON carteiras_adquiridas FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_refin_updated ON refinanciamentos;
CREATE TRIGGER trg_refin_updated BEFORE UPDATE ON refinanciamentos FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_integracoes_updated ON integracoes;
CREATE TRIGGER trg_integracoes_updated BEFORE UPDATE ON integracoes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE carteiras_adquiridas ENABLE ROW LEVEL SECURITY;
ALTER TABLE refinanciamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE integracoes ENABLE ROW LEVEL SECURITY;

-- Carteiras e integrações: camada do grupo → escrita admin, leitura autenticada
DROP POLICY IF EXISTS carteiras_read ON carteiras_adquiridas;
CREATE POLICY carteiras_read ON carteiras_adquiridas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS carteiras_admin ON carteiras_adquiridas;
CREATE POLICY carteiras_admin ON carteiras_adquiridas FOR ALL TO authenticated USING (auth_is_grupo_admin()) WITH CHECK (auth_is_grupo_admin());

DROP POLICY IF EXISTS integracoes_read ON integracoes;
CREATE POLICY integracoes_read ON integracoes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS integracoes_admin ON integracoes;
CREATE POLICY integracoes_admin ON integracoes FOR ALL TO authenticated USING (auth_is_grupo_admin()) WITH CHECK (auth_is_grupo_admin());

-- Refinanciamento: escopo por franquia ou admin
DROP POLICY IF EXISTS refin_rls ON refinanciamentos;
CREATE POLICY refin_rls ON refinanciamentos FOR ALL TO authenticated
  USING (auth_is_grupo_admin() OR auth_tem_escopo(NULL, franquia_id))
  WITH CHECK (auth_is_grupo_admin() OR auth_tem_escopo(NULL, franquia_id));

-- Seed das integrações conhecidas (só se vazio)
INSERT INTO integracoes (nome, tipo, status)
SELECT * FROM (VALUES
  ('PixConsig','convenios','inativo'),
  ('UY3','ccb','inativo'),
  ('Kanastra','fidc','inativo'),
  ('Utility','fidc','inativo'),
  ('Clicksign','assinatura','inativo'),
  ('WhatsApp','mensageria','inativo'),
  ('Resend','notificacao','inativo')
) v(nome, tipo, status)
WHERE NOT EXISTS (SELECT 1 FROM integracoes);
