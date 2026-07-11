-- ============================================================
-- CONSIGTEC — Estágio 5: Formalização Digital, Anti-fraude & CCB
-- Camada de REGISTRO do handoff UY3 (fase 1 = manual). A UY3 executa
-- (selfie, prova de vida, anti-fraude, emissão de CCB, assinatura
-- Clicksign); o CONSIGTEC registra e concilia. Aplicar após 0007.
-- Idempotente.
-- ============================================================

DO $$ BEGIN CREATE TYPE status_formalizacao AS ENUM
  ('iniciada','em_analise','aprovada','reprovada','concluida','cancelada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE resultado_antifraude AS ENUM
  ('aprovado','reprovado','revisao'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE status_ccb AS ENUM
  ('emitida','enviada_assinatura','assinada','cancelada','liquidada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------
-- FORMALIZAÇÃO DIGITAL
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS formalizacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id uuid REFERENCES propostas(id) ON DELETE CASCADE,
  contrato_id uuid REFERENCES contratos(id) ON DELETE CASCADE,
  selfie_ok boolean NOT NULL DEFAULT false,
  prova_vida_ok boolean NOT NULL DEFAULT false,
  documentos_ok boolean NOT NULL DEFAULT false,
  aceite_termo boolean NOT NULL DEFAULT false,
  aceite_em timestamptz,
  canal_envio text,                    -- ex.: whatsapp
  link_formalizacao text,              -- link enviado ao cliente
  status status_formalizacao NOT NULL DEFAULT 'iniciada',
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT formalizacoes_origem_chk CHECK (proposta_id IS NOT NULL OR contrato_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_formalizacoes_proposta ON formalizacoes(proposta_id);
CREATE INDEX IF NOT EXISTS idx_formalizacoes_contrato ON formalizacoes(contrato_id);

-- ------------------------------------------------------------
-- ANÁLISE ANTI-FRAUDE (resultado UY3)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analises_antifraude (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formalizacao_id uuid REFERENCES formalizacoes(id) ON DELETE CASCADE,
  proposta_id uuid REFERENCES propostas(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'UY3',
  score numeric(6,2),
  resultado resultado_antifraude NOT NULL DEFAULT 'revisao',
  motivo text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_antifraude_formalizacao ON analises_antifraude(formalizacao_id);
CREATE INDEX IF NOT EXISTS idx_antifraude_proposta ON analises_antifraude(proposta_id);

-- ------------------------------------------------------------
-- CCB (emissão UY3 + assinatura Clicksign)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ccbs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text UNIQUE,                  -- número da CCB (casa com item de cessão futuro)
  proposta_id uuid REFERENCES propostas(id) ON DELETE SET NULL,
  contrato_id uuid REFERENCES contratos(id) ON DELETE SET NULL,
  formalizacao_id uuid REFERENCES formalizacoes(id) ON DELETE SET NULL,
  valor_principal numeric(12,2),
  valor_total numeric(12,2),
  taxa_mensal numeric(6,4),
  prazo int,
  status status_ccb NOT NULL DEFAULT 'emitida',
  provider text NOT NULL DEFAULT 'UY3',
  link_assinatura text,                -- link Clicksign (via UY3)
  documento_hash text,                 -- hash SHA256 (Clicksign)
  emitida_em timestamptz,
  assinada_em timestamptz,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ccbs_origem_chk CHECK (proposta_id IS NOT NULL OR contrato_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_ccbs_proposta ON ccbs(proposta_id);
CREATE INDEX IF NOT EXISTS idx_ccbs_contrato ON ccbs(contrato_id);
CREATE INDEX IF NOT EXISTS idx_ccbs_status ON ccbs(status);

-- ------------------------------------------------------------
-- TRIGGERS updated_at
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_formalizacoes_updated ON formalizacoes;
CREATE TRIGGER trg_formalizacoes_updated BEFORE UPDATE ON formalizacoes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_ccbs_updated ON ccbs;
CREATE TRIGGER trg_ccbs_updated BEFORE UPDATE ON ccbs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- RLS — escopo herdado da proposta OU do contrato
-- ------------------------------------------------------------
ALTER TABLE formalizacoes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE analises_antifraude ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccbs                ENABLE ROW LEVEL SECURITY;

-- helper de escopo por (proposta|contrato) reutilizável
CREATE OR REPLACE FUNCTION public.auth_escopo_prop_contr(p_proposta uuid, p_contrato uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT
    (p_proposta IS NOT NULL AND EXISTS (SELECT 1 FROM propostas p WHERE p.id = p_proposta AND auth_tem_escopo(p.empresa_id, p.franquia_id)))
    OR
    (p_contrato IS NOT NULL AND EXISTS (SELECT 1 FROM contratos c WHERE c.id = p_contrato AND auth_tem_escopo(c.empresa_id, c.franquia_id)));
$$;

DROP POLICY IF EXISTS formalizacoes_rls ON formalizacoes;
CREATE POLICY formalizacoes_rls ON formalizacoes FOR ALL TO authenticated
  USING (auth_escopo_prop_contr(proposta_id, contrato_id))
  WITH CHECK (auth_escopo_prop_contr(proposta_id, contrato_id));

DROP POLICY IF EXISTS ccbs_rls ON ccbs;
CREATE POLICY ccbs_rls ON ccbs FOR ALL TO authenticated
  USING (auth_escopo_prop_contr(proposta_id, contrato_id))
  WITH CHECK (auth_escopo_prop_contr(proposta_id, contrato_id));

DROP POLICY IF EXISTS antifraude_rls ON analises_antifraude;
CREATE POLICY antifraude_rls ON analises_antifraude FOR ALL TO authenticated
  USING (
    (proposta_id IS NOT NULL AND EXISTS (SELECT 1 FROM propostas p WHERE p.id = proposta_id AND auth_tem_escopo(p.empresa_id, p.franquia_id)))
    OR (formalizacao_id IS NOT NULL AND EXISTS (SELECT 1 FROM formalizacoes f WHERE f.id = formalizacao_id AND auth_escopo_prop_contr(f.proposta_id, f.contrato_id)))
  )
  WITH CHECK (
    (proposta_id IS NOT NULL AND EXISTS (SELECT 1 FROM propostas p WHERE p.id = proposta_id AND auth_tem_escopo(p.empresa_id, p.franquia_id)))
    OR (formalizacao_id IS NOT NULL AND EXISTS (SELECT 1 FROM formalizacoes f WHERE f.id = formalizacao_id AND auth_escopo_prop_contr(f.proposta_id, f.contrato_id)))
  );
