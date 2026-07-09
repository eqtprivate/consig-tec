-- ============================================================
-- CONSIGTEC — Estágio 1: Núcleo do Crédito Consignado
-- Convênio → Cliente → Proposta → Contrato → Averbação → Parcelas → Comissão
--
-- Aplicar após o schema base (schema.sql). Idempotente.
-- ============================================================

-- ============================================================
-- TIPOS (ENUMs)
-- ============================================================
DO $$ BEGIN CREATE TYPE tipo_convenio AS ENUM ('publico', 'privado', 'inss', 'militar'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE status_proposta AS ENUM ('rascunho', 'em_analise', 'aprovada', 'reprovada', 'cancelada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE status_contrato AS ENUM ('ativo', 'quitado', 'cancelado', 'inadimplente'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE status_averbacao AS ENUM ('pendente', 'averbada', 'recusada', 'cancelada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE status_parcela AS ENUM ('aberta', 'paga', 'atrasada', 'renegociada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE status_comissao AS ENUM ('prevista', 'paga', 'cancelada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- HELPER RLS: usuário tem escopo sobre (empresa, franquia)?
-- ============================================================
CREATE OR REPLACE FUNCTION public.auth_tem_escopo(p_empresa uuid, p_franquia uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT auth_is_grupo_admin()
      OR EXISTS (
        SELECT 1 FROM vinculos v
        WHERE v.usuario_id = auth.uid() AND v.ativo
          AND ( (p_franquia IS NOT NULL AND v.franquia_id = p_franquia)
             OR (p_empresa  IS NOT NULL AND v.empresa_id  = p_empresa) )
      );
$$;

-- ============================================================
-- CONVÊNIOS (órgãos/entidades pagadoras)
-- ============================================================
CREATE TABLE IF NOT EXISTS convenios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES empresas(id),
  nome text NOT NULL,
  orgao text,
  tipo tipo_convenio NOT NULL DEFAULT 'privado',
  margem_consignavel numeric(5,2),
  taxa_mensal numeric(6,4),
  prazo_maximo int,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- CLIENTES (tomadores)
-- ============================================================
CREATE TABLE IF NOT EXISTS clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf text NOT NULL UNIQUE,
  nome text NOT NULL,
  data_nascimento date,
  telefone text,
  email text,
  matricula text,
  convenio_id uuid REFERENCES convenios(id),
  empresa_id uuid REFERENCES empresas(id),
  franquia_id uuid REFERENCES franquias(id),
  margem_disponivel numeric(12,2),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- PROPOSTAS
-- ============================================================
CREATE TABLE IF NOT EXISTS propostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text,
  cliente_id uuid NOT NULL REFERENCES clientes(id),
  convenio_id uuid REFERENCES convenios(id),
  empresa_id uuid REFERENCES empresas(id),
  franquia_id uuid REFERENCES franquias(id),
  usuario_id uuid REFERENCES usuarios(id),
  valor_solicitado numeric(12,2) NOT NULL,
  prazo int NOT NULL,
  taxa_mensal numeric(6,4),
  valor_parcela numeric(12,2),
  status status_proposta NOT NULL DEFAULT 'rascunho',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- CONTRATOS
-- ============================================================
CREATE TABLE IF NOT EXISTS contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id uuid REFERENCES propostas(id),
  cliente_id uuid NOT NULL REFERENCES clientes(id),
  convenio_id uuid REFERENCES convenios(id),
  empresa_id uuid REFERENCES empresas(id),
  franquia_id uuid REFERENCES franquias(id),
  numero_contrato text UNIQUE,
  valor_principal numeric(12,2) NOT NULL,
  valor_total numeric(12,2),
  prazo int NOT NULL,
  taxa_mensal numeric(6,4),
  valor_parcela numeric(12,2),
  data_assinatura date,
  status status_contrato NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- AVERBAÇÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS averbacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  convenio_id uuid REFERENCES convenios(id),
  protocolo text,
  status status_averbacao NOT NULL DEFAULT 'pendente',
  data_averbacao date,
  motivo_recusa text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- PARCELAS
-- ============================================================
CREATE TABLE IF NOT EXISTS parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  numero int NOT NULL,
  vencimento date NOT NULL,
  valor numeric(12,2) NOT NULL,
  valor_pago numeric(12,2),
  data_pagamento date,
  status status_parcela NOT NULL DEFAULT 'aberta',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contrato_id, numero)
);

-- ============================================================
-- COMISSÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS comissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid REFERENCES contratos(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES usuarios(id),
  franquia_id uuid REFERENCES franquias(id),
  tipo text,
  base_calculo numeric(12,2),
  percentual numeric(6,4),
  valor numeric(12,2),
  status status_comissao NOT NULL DEFAULT 'prevista',
  data_pagamento date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_convenios_empresa   ON convenios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_clientes_convenio    ON clientes(convenio_id);
CREATE INDEX IF NOT EXISTS idx_clientes_franquia    ON clientes(franquia_id);
CREATE INDEX IF NOT EXISTS idx_propostas_cliente    ON propostas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_propostas_status     ON propostas(status);
CREATE INDEX IF NOT EXISTS idx_contratos_cliente    ON contratos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contratos_status     ON contratos(status);
CREATE INDEX IF NOT EXISTS idx_averbacoes_contrato  ON averbacoes(contrato_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_contrato    ON parcelas(contrato_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_vencimento  ON parcelas(vencimento);
CREATE INDEX IF NOT EXISTS idx_comissoes_contrato   ON comissoes(contrato_id);

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================
DROP TRIGGER IF EXISTS trg_convenios_updated ON convenios;
CREATE TRIGGER trg_convenios_updated BEFORE UPDATE ON convenios FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_clientes_updated ON clientes;
CREATE TRIGGER trg_clientes_updated BEFORE UPDATE ON clientes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_propostas_updated ON propostas;
CREATE TRIGGER trg_propostas_updated BEFORE UPDATE ON propostas FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_contratos_updated ON contratos;
CREATE TRIGGER trg_contratos_updated BEFORE UPDATE ON contratos FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_averbacoes_updated ON averbacoes;
CREATE TRIGGER trg_averbacoes_updated BEFORE UPDATE ON averbacoes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_comissoes_updated ON comissoes;
CREATE TRIGGER trg_comissoes_updated BEFORE UPDATE ON comissoes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE convenios  ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE propostas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE averbacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE comissoes  ENABLE ROW LEVEL SECURITY;

-- Convênios: leitura para autenticados; escrita para admin
DROP POLICY IF EXISTS convenios_read ON convenios;
CREATE POLICY convenios_read  ON convenios FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS convenios_admin ON convenios;
CREATE POLICY convenios_admin ON convenios FOR ALL TO authenticated USING (auth_is_grupo_admin()) WITH CHECK (auth_is_grupo_admin());

-- Clientes / Propostas / Contratos: escopo por (empresa, franquia)
DROP POLICY IF EXISTS clientes_rls ON clientes;
CREATE POLICY clientes_rls  ON clientes  FOR ALL TO authenticated
  USING (auth_tem_escopo(empresa_id, franquia_id)) WITH CHECK (auth_tem_escopo(empresa_id, franquia_id));
DROP POLICY IF EXISTS propostas_rls ON propostas;
CREATE POLICY propostas_rls ON propostas FOR ALL TO authenticated
  USING (auth_tem_escopo(empresa_id, franquia_id)) WITH CHECK (auth_tem_escopo(empresa_id, franquia_id));
DROP POLICY IF EXISTS contratos_rls ON contratos;
CREATE POLICY contratos_rls ON contratos FOR ALL TO authenticated
  USING (auth_tem_escopo(empresa_id, franquia_id)) WITH CHECK (auth_tem_escopo(empresa_id, franquia_id));

-- Averbações / Parcelas: seguem o escopo do contrato-pai
DROP POLICY IF EXISTS averbacoes_rls ON averbacoes;
CREATE POLICY averbacoes_rls ON averbacoes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM contratos c WHERE c.id = contrato_id AND auth_tem_escopo(c.empresa_id, c.franquia_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM contratos c WHERE c.id = contrato_id AND auth_tem_escopo(c.empresa_id, c.franquia_id)));
DROP POLICY IF EXISTS parcelas_rls ON parcelas;
CREATE POLICY parcelas_rls ON parcelas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM contratos c WHERE c.id = contrato_id AND auth_tem_escopo(c.empresa_id, c.franquia_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM contratos c WHERE c.id = contrato_id AND auth_tem_escopo(c.empresa_id, c.franquia_id)));

-- Comissões: dono (usuario_id) ou escopo da franquia ou admin
DROP POLICY IF EXISTS comissoes_rls ON comissoes;
CREATE POLICY comissoes_rls ON comissoes FOR ALL TO authenticated
  USING (auth_is_grupo_admin() OR usuario_id = auth.uid() OR auth_tem_escopo(NULL, franquia_id))
  WITH CHECK (auth_is_grupo_admin() OR usuario_id = auth.uid() OR auth_tem_escopo(NULL, franquia_id));
