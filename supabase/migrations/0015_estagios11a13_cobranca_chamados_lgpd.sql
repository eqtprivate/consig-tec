-- ============================================================
-- CONSIGTEC — Estágios 11–13: Cobrança/Default, Chamados/Inconsistências, LGPD
-- Aplicar após 0014. Idempotente.
-- ============================================================

DO $$ BEGIN CREATE TYPE gatilho_cobranca AS ENUM
  ('falha_repasse','inadimplencia','glosa','divergencia'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE status_cobranca AS ENUM
  ('aberta','em_acordo','resolvida','perdida'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE status_chamado AS ENUM
  ('aberto','em_andamento','resolvido','fechado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE tipo_chamado AS ENUM
  ('chamado','inconsistencia','lgpd'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE tipo_lgpd AS ENUM
  ('acesso','correcao','exclusao','portabilidade','revogacao','oposicao'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE status_lgpd AS ENUM
  ('recebida','em_analise','atendida','recusada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------- Cobrança / Default / Renegociação (11) ----------------
CREATE TABLE IF NOT EXISTS cobrancas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid REFERENCES contratos(id) ON DELETE CASCADE,
  parcela_id uuid REFERENCES parcelas(id) ON DELETE SET NULL,
  franquia_id uuid REFERENCES franquias(id),
  gatilho gatilho_cobranca NOT NULL DEFAULT 'inadimplencia',
  status status_cobranca NOT NULL DEFAULT 'aberta',
  valor numeric(12,2),
  data_gatilho date,
  acordo text,
  responsavel_id uuid REFERENCES usuarios(id),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cobrancas_contrato ON cobrancas(contrato_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_status ON cobrancas(status);

-- ---------------- Chamados & Inconsistências (12) ----------------
CREATE TABLE IF NOT EXISTS chamados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo tipo_chamado NOT NULL DEFAULT 'chamado',
  categoria text,
  assunto text NOT NULL,
  descricao text,
  status status_chamado NOT NULL DEFAULT 'aberto',
  prioridade text NOT NULL DEFAULT 'media',
  solicitante_nome text,
  solicitante_email text,
  cliente_id uuid REFERENCES clientes(id) ON DELETE SET NULL,
  responsavel_id uuid REFERENCES usuarios(id),
  franquia_id uuid REFERENCES franquias(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chamados_status ON chamados(status);
CREATE INDEX IF NOT EXISTS idx_chamados_tipo ON chamados(tipo);

-- ---------------- LGPD — solicitações do titular (13) ----------------
CREATE TABLE IF NOT EXISTS lgpd_solicitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titular_nome text NOT NULL,
  titular_cpf text,
  titular_email text,
  tipo tipo_lgpd NOT NULL,
  status status_lgpd NOT NULL DEFAULT 'recebida',
  descricao text,
  prazo_limite date,
  atendida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_cobrancas_updated ON cobrancas;
CREATE TRIGGER trg_cobrancas_updated BEFORE UPDATE ON cobrancas FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_chamados_updated ON chamados;
CREATE TRIGGER trg_chamados_updated BEFORE UPDATE ON chamados FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_lgpd_updated ON lgpd_solicitacoes;
CREATE TRIGGER trg_lgpd_updated BEFORE UPDATE ON lgpd_solicitacoes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE cobrancas ENABLE ROW LEVEL SECURITY;
ALTER TABLE chamados ENABLE ROW LEVEL SECURITY;
ALTER TABLE lgpd_solicitacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cobrancas_rls ON cobrancas;
CREATE POLICY cobrancas_rls ON cobrancas FOR ALL TO authenticated
  USING (auth_is_grupo_admin() OR auth_tem_escopo(NULL, franquia_id))
  WITH CHECK (auth_is_grupo_admin() OR auth_tem_escopo(NULL, franquia_id));

DROP POLICY IF EXISTS chamados_rls ON chamados;
CREATE POLICY chamados_rls ON chamados FOR ALL TO authenticated
  USING (auth_is_grupo_admin() OR auth_tem_escopo(NULL, franquia_id) OR franquia_id IS NULL)
  WITH CHECK (auth_is_grupo_admin() OR auth_tem_escopo(NULL, franquia_id) OR franquia_id IS NULL);

-- LGPD: dado sensível — apenas admin do grupo
DROP POLICY IF EXISTS lgpd_admin ON lgpd_solicitacoes;
CREATE POLICY lgpd_admin ON lgpd_solicitacoes FOR ALL TO authenticated
  USING (auth_is_grupo_admin()) WITH CHECK (auth_is_grupo_admin());
