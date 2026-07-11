-- ============================================================
-- CONSIGTEC — Estágio 1 (roadmap v2): Integração PixConsig
-- Espelho local (ACL) dos convênios/entidades + overlay comercial
-- próprio + cartão benefício. Aplicar após 0004. Idempotente.
--
-- Fonte da verdade do credenciamento = PixConsig. Aqui guardamos o
-- espelho (read model) com chaves externas pixconsig_*_id e o overlay
-- comercial que é propriedade do CONSIGTEC. MVP: origem via CSV/manual;
-- depois via API/webhooks (mesmo schema).
-- ============================================================

DO $$ BEGIN CREATE TYPE tipo_margem AS ENUM ('apartada', 'principal', 'cartao'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE origem_dado AS ENUM ('manual', 'csv', 'pixconsig'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- ENTIDADES CADASTRO (read model do ente / prefeitura — via PixConsig)
-- ============================================================
CREATE TABLE IF NOT EXISTS entidades_cadastro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pixconsig_entidade_id text UNIQUE,
  nome text NOT NULL,
  cnpj text,
  natureza_juridica text,
  tipo text,
  cidade text,
  uf char(2),
  codigo_ibge text,
  populacao integer,
  servidores integer,
  norma_autorizadora text,
  sistema_averbacao text,
  vigencia_inicio date,
  vigencia_fim date,           -- PixConsig não possui; virá null
  capag text,                  -- PixConsig entrega só a classificação (sem data/fonte)
  origem_dado origem_dado NOT NULL DEFAULT 'manual',
  ultima_sincronizacao timestamptz,
  status_sync text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- CONVENIOS — enriquecer com espelho PixConsig + cartão benefício
-- ============================================================
ALTER TABLE convenios ADD COLUMN IF NOT EXISTS entidade_id uuid REFERENCES entidades_cadastro(id);
ALTER TABLE convenios ADD COLUMN IF NOT EXISTS pixconsig_convenio_id text;
ALTER TABLE convenios ADD COLUMN IF NOT EXISTS tipo_margem tipo_margem NOT NULL DEFAULT 'cartao';
ALTER TABLE convenios ADD COLUMN IF NOT EXISTS percentual_margem_apartada numeric(5,2);
ALTER TABLE convenios ADD COLUMN IF NOT EXISTS rotativo boolean NOT NULL DEFAULT true;
ALTER TABLE convenios ADD COLUMN IF NOT EXISTS saque_vinculado boolean NOT NULL DEFAULT true;
ALTER TABLE convenios ADD COLUMN IF NOT EXISTS norma_autorizadora text;
ALTER TABLE convenios ADD COLUMN IF NOT EXISTS spread numeric(6,4);
ALTER TABLE convenios ADD COLUMN IF NOT EXISTS capag text;
ALTER TABLE convenios ADD COLUMN IF NOT EXISTS origem_dado origem_dado NOT NULL DEFAULT 'manual';
ALTER TABLE convenios ADD COLUMN IF NOT EXISTS ultima_sincronizacao timestamptz;
ALTER TABLE convenios ADD COLUMN IF NOT EXISTS status_sync text;
-- Campos reais confirmados pela PixConsig (resposta v1)
ALTER TABLE convenios ADD COLUMN IF NOT EXISTS status_detalhado text;        -- enum interno cru da PixConsig (ATIVA, AGUARDANDO_DECRETO...)
ALTER TABLE convenios ADD COLUMN IF NOT EXISTS decreto_enviado boolean;
ALTER TABLE convenios ADD COLUMN IF NOT EXISTS arquivo_decreto_url text;     -- link do PDF do decreto (não é o DOM)
ALTER TABLE convenios ADD COLUMN IF NOT EXISTS data_atribuicao timestamptz;  -- início do relógio de credenciamento
ALTER TABLE convenios ADD COLUMN IF NOT EXISTS margem_disponivel numeric(5,2);
-- Idempotência para o caso da 0005 já ter sido aplicada antes destes campos:
ALTER TABLE entidades_cadastro ADD COLUMN IF NOT EXISTS codigo_ibge text;
ALTER TABLE entidades_cadastro ADD COLUMN IF NOT EXISTS populacao integer;
ALTER TABLE entidades_cadastro ADD COLUMN IF NOT EXISTS servidores integer;

-- ============================================================
-- PROPRIEDADE DOS DADOS (confirmado com a PixConsig, v1)
-- ------------------------------------------------------------
-- VÊM da PixConsig (espelho, read-only): cnpj, nome, cidade/uf, endereço,
--   codigo_ibge, populacao, servidores, status(+status_detalhado),
--   data_atribuicao, capag (classificação), arquivo_decreto_url,
--   decreto_enviado, sistema de averbação (processadora), tipo_margem,
--   percentual_margem_apartada (margemDecretoCartao), margem_disponivel.
-- NÃO existem na PixConsig -> propriedade do CONSIGTEC (overlay):
--   taxa, spread, comissao_prefeitura, prazo_min/max, valor_max.
--   (convenios.taxa_mensal/prazo_maximo e overlay_comercial_convenio.spread/
--    comissao_prefeitura são preenchidos pelo CONSIGTEC, não sincronizados.)
-- Sem `version` na PixConsig -> sync = full inicial + delta diário +
--   full-sync semanal, tratando o delta como candidatos (sobrescreve espelho).
-- ============================================================

DO $$ BEGIN
  ALTER TABLE convenios ADD CONSTRAINT convenios_pixconsig_convenio_id_key UNIQUE (pixconsig_convenio_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- OVERLAY COMERCIAL (propriedade do CONSIGTEC — não vem da PixConsig)
-- Comissão/spread rateados entre canal/franquia/líder/corban/operador,
-- habilitação de canal e metas.
-- ============================================================
CREATE TABLE IF NOT EXISTS overlay_comercial_convenio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convenio_id uuid NOT NULL REFERENCES convenios(id) ON DELETE CASCADE,
  comissao_prefeitura numeric(6,4),
  spread numeric(6,4),
  rateio jsonb NOT NULL DEFAULT '{}'::jsonb,
  habilitado_canal boolean NOT NULL DEFAULT false,
  metas jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (convenio_id)
);

-- ============================================================
-- LOG DE SINCRONIZAÇÕES (webhook / pull / csv / manual)
-- ============================================================
CREATE TABLE IF NOT EXISTS sincronizacoes_convenio (
  id bigserial PRIMARY KEY,
  origem text NOT NULL,
  evento text,
  convenio_id uuid REFERENCES convenios(id) ON DELETE SET NULL,
  entidade_id uuid REFERENCES entidades_cadastro(id) ON DELETE SET NULL,
  payload jsonb,
  status text,
  mensagem text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_convenios_entidade ON convenios(entidade_id);
CREATE INDEX IF NOT EXISTS idx_convenios_pixconsig ON convenios(pixconsig_convenio_id);
CREATE INDEX IF NOT EXISTS idx_overlay_convenio ON overlay_comercial_convenio(convenio_id);
CREATE INDEX IF NOT EXISTS idx_sinc_convenio ON sincronizacoes_convenio(convenio_id);
CREATE INDEX IF NOT EXISTS idx_sinc_created ON sincronizacoes_convenio(created_at DESC);

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================
DROP TRIGGER IF EXISTS trg_entidades_updated ON entidades_cadastro;
CREATE TRIGGER trg_entidades_updated BEFORE UPDATE ON entidades_cadastro FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_overlay_updated ON overlay_comercial_convenio;
CREATE TRIGGER trg_overlay_updated BEFORE UPDATE ON overlay_comercial_convenio FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE entidades_cadastro         ENABLE ROW LEVEL SECURITY;
ALTER TABLE overlay_comercial_convenio ENABLE ROW LEVEL SECURITY;
ALTER TABLE sincronizacoes_convenio    ENABLE ROW LEVEL SECURITY;

-- Entidades: leitura para autenticados; escrita para admin
DROP POLICY IF EXISTS entidades_read ON entidades_cadastro;
CREATE POLICY entidades_read  ON entidades_cadastro FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS entidades_admin ON entidades_cadastro;
CREATE POLICY entidades_admin ON entidades_cadastro FOR ALL TO authenticated USING (auth_is_grupo_admin()) WITH CHECK (auth_is_grupo_admin());

-- Overlay comercial: leitura autenticados; escrita admin
DROP POLICY IF EXISTS overlay_read ON overlay_comercial_convenio;
CREATE POLICY overlay_read  ON overlay_comercial_convenio FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS overlay_admin ON overlay_comercial_convenio;
CREATE POLICY overlay_admin ON overlay_comercial_convenio FOR ALL TO authenticated USING (auth_is_grupo_admin()) WITH CHECK (auth_is_grupo_admin());

-- Sincronizações: apenas admin lê (log técnico)
DROP POLICY IF EXISTS sinc_admin ON sincronizacoes_convenio;
CREATE POLICY sinc_admin ON sincronizacoes_convenio FOR SELECT TO authenticated USING (auth_is_grupo_admin());
