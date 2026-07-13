-- ============================================================
-- CONSIGTEC — Schema de Banco de Dados
-- CONSIGTEC — Plataforma de Crédito Consignado
--
-- Este arquivo é a FONTE DA VERDADE do schema e foi reconciliado
-- a partir do banco Supabase ao vivo (projeto blnslbrflspiflrwsuzh,
-- região sa-east-1). Mantê-lo alinhado ao banco: toda mudança de
-- schema deve ser feita aqui e aplicada via migração.
--
-- Aplicar no SQL Editor do Supabase (idempotente).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TIPOS (ENUMs)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE tipo_empresa AS ENUM ('grupo', 'originadora', 'franqueadora', 'investidor', 'operacional');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE prioridade_pendencia AS ENUM ('baixa', 'media', 'alta', 'critica');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE status_pendencia AS ENUM ('aberta', 'em_andamento', 'aguardando_terceiro', 'vencida', 'resolvida', 'cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE status_envio AS ENUM ('pendente', 'enviado', 'falhou');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- EMPRESAS (hierarquia: Grupo → Originadora / Franqueadora / Investidor)
-- ============================================================
CREATE TABLE IF NOT EXISTS empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_pai_id uuid REFERENCES empresas(id),
  nome text NOT NULL,
  cnpj text UNIQUE,
  tipo tipo_empresa NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- FRANQUIAS / UNIDADES
-- ============================================================
CREATE TABLE IF NOT EXISTS franquias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id),
  nome text NOT NULL,
  cnpj text,
  cidade text,
  uf char(2),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- ÁREAS DO PROCESSO
-- ============================================================
CREATE TABLE IF NOT EXISTS areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text
);

-- ============================================================
-- PAPÉIS (perfis de acesso)
-- ============================================================
CREATE TABLE IF NOT EXISTS papeis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text
);

-- ============================================================
-- USUÁRIOS (perfil estendido de auth.users; id = auth.users.id)
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL,
  cpf text,
  is_grupo_admin boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- VÍNCULOS (usuário × empresa/franquia × área × papel)
-- ============================================================
CREATE TABLE IF NOT EXISTS vinculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES empresas(id),
  franquia_id uuid REFERENCES franquias(id),
  area_id uuid NOT NULL REFERENCES areas(id),
  papel_id uuid NOT NULL REFERENCES papeis(id),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vinculos_check CHECK (empresa_id IS NOT NULL OR franquia_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS vinculos_usuario_id_idx ON vinculos(usuario_id);

-- ============================================================
-- PENDÊNCIAS
-- ============================================================
CREATE TABLE IF NOT EXISTS pendencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text,
  descricao text,
  origem text NOT NULL DEFAULT 'manual',
  registro_ref text,
  empresa_id uuid REFERENCES empresas(id),
  franquia_id uuid REFERENCES franquias(id),
  area_id uuid NOT NULL REFERENCES areas(id),
  responsavel_id uuid REFERENCES usuarios(id),
  prioridade prioridade_pendencia NOT NULL DEFAULT 'media',
  prazo_sla timestamptz,
  status status_pendencia NOT NULL DEFAULT 'aberta',
  historico jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- SLA — ETAPAS E REGRAS DE ESCALONAMENTO
-- ============================================================
CREATE TABLE IF NOT EXISTS sla_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etapa text NOT NULL,
  prazo_horas integer NOT NULL,
  regra_escalonamento text
);

-- ============================================================
-- AUDITORIA (trilha de alterações)
-- ============================================================
CREATE TABLE IF NOT EXISTS auditoria (
  id bigserial PRIMARY KEY,
  entidade text NOT NULL,
  registro_id text,
  acao text NOT NULL,
  usuario_id uuid REFERENCES usuarios(id),
  valor_antigo jsonb,
  valor_novo jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- LOGS DE ACESSO
-- ============================================================
CREATE TABLE IF NOT EXISTS logs_acesso (
  id bigserial PRIMARY KEY,
  usuario_id uuid REFERENCES usuarios(id),
  acao text NOT NULL,
  entidade text,
  registro_id text,
  ip inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- NOTIFICAÇÕES — REGRAS E FILA DE ENVIO
-- ============================================================
CREATE TABLE IF NOT EXISTS regras_notificacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento text NOT NULL,
  destinatarios_perfil jsonb NOT NULL DEFAULT '[]'::jsonb,
  template text,
  ativo boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento text NOT NULL,
  registro_ref text,
  destinatarios jsonb NOT NULL DEFAULT '[]'::jsonb,
  canal text NOT NULL DEFAULT 'email',
  assunto text,
  corpo text,
  status_envio status_envio NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- CONSENTIMENTOS (LGPD)
-- ============================================================
CREATE TABLE IF NOT EXISTS consentimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titular_ref text NOT NULL,
  tipo text NOT NULL,
  versao_termo text,
  canal text,
  ip inet,
  documento_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- CONFIGURAÇÕES (chave/valor)
-- ============================================================
CREATE TABLE IF NOT EXISTS configuracoes (
  chave text PRIMARY KEY,
  valor jsonb,
  descricao text
);

-- ============================================================
-- FUNÇÕES
-- ============================================================
-- Mantém updated_at em dia
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN new.updated_at = now(); RETURN new; END $$;

-- Usuário autenticado é admin do grupo?
CREATE OR REPLACE FUNCTION public.auth_is_grupo_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT coalesce((SELECT is_grupo_admin FROM usuarios WHERE id = auth.uid()), false);
$$;

-- Usuário pode acessar registros de (empresa, franquia, área)?
CREATE OR REPLACE FUNCTION public.auth_can_access(p_empresa uuid, p_franquia uuid, p_area uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT auth_is_grupo_admin()
      OR EXISTS (
        SELECT 1 FROM vinculos v
        WHERE v.usuario_id = auth.uid() AND v.ativo AND v.area_id = p_area
          AND ( (p_franquia IS NOT NULL AND v.franquia_id = p_franquia)
             OR (p_empresa  IS NOT NULL AND v.empresa_id  = p_empresa) )
      );
$$;

-- ============================================================
-- TRIGGERS (updated_at)
-- ============================================================
DROP TRIGGER IF EXISTS trg_empresas_updated ON empresas;
CREATE TRIGGER trg_empresas_updated BEFORE UPDATE ON empresas FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_franquias_updated ON franquias;
CREATE TRIGGER trg_franquias_updated BEFORE UPDATE ON franquias FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_usuarios_updated ON usuarios;
CREATE TRIGGER trg_usuarios_updated BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_pendencias_updated ON pendencias;
CREATE TRIGGER trg_pendencias_updated BEFORE UPDATE ON pendencias FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- AUTO-PROVISIONAMENTO DE USUÁRIO
-- Cria automaticamente o perfil em public.usuarios quando um
-- novo usuário se cadastra via Supabase Auth.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.usuarios (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
ALTER TABLE empresas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE franquias           ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE papeis              ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios            ENABLE ROW LEVEL SECURITY;
ALTER TABLE vinculos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE pendencias          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_etapas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria           ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_acesso         ENABLE ROW LEVEL SECURITY;
ALTER TABLE regras_notificacao  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE consentimentos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes       ENABLE ROW LEVEL SECURITY;

-- Empresas / Franquias: escopo por vínculo (ou admin)
CREATE POLICY "empresas_scope" ON empresas FOR SELECT TO authenticated
  USING (auth_is_grupo_admin() OR (id IN (
    SELECT empresa_id FROM vinculos WHERE usuario_id = auth.uid() AND ativo)));

CREATE POLICY "franquias_scope" ON franquias FOR SELECT TO authenticated
  USING (auth_is_grupo_admin() OR (id IN (
    SELECT franquia_id FROM vinculos WHERE usuario_id = auth.uid() AND ativo)));

-- Áreas / Papéis: leitura para todos autenticados; gestão para admin
CREATE POLICY "areas_read"  ON areas  FOR SELECT TO authenticated USING (true);
CREATE POLICY "areas_admin" ON areas  FOR ALL    TO authenticated USING (auth_is_grupo_admin()) WITH CHECK (auth_is_grupo_admin());
CREATE POLICY "papeis_read"  ON papeis FOR SELECT TO authenticated USING (true);
CREATE POLICY "papeis_admin" ON papeis FOR ALL    TO authenticated USING (auth_is_grupo_admin()) WITH CHECK (auth_is_grupo_admin());

-- Usuários: cada um vê o próprio; admin gerencia todos
CREATE POLICY "usuarios_self"  ON usuarios FOR SELECT TO authenticated USING (id = auth.uid() OR auth_is_grupo_admin());
CREATE POLICY "usuarios_admin" ON usuarios FOR ALL    TO authenticated USING (auth_is_grupo_admin()) WITH CHECK (auth_is_grupo_admin());

-- Vínculos: cada um vê os próprios; admin gerencia todos
CREATE POLICY "vinculos_self"  ON vinculos FOR SELECT TO authenticated USING (usuario_id = auth.uid() OR auth_is_grupo_admin());
CREATE POLICY "vinculos_admin" ON vinculos FOR ALL    TO authenticated USING (auth_is_grupo_admin()) WITH CHECK (auth_is_grupo_admin());

-- Pendências: escopo por (empresa, franquia, área)
CREATE POLICY "pendencias_rls" ON pendencias FOR ALL TO authenticated
  USING (auth_can_access(empresa_id, franquia_id, area_id))
  WITH CHECK (auth_can_access(empresa_id, franquia_id, area_id));

-- SLA: leitura para todos autenticados
CREATE POLICY "sla_read" ON sla_etapas FOR SELECT TO authenticated USING (true);

-- Auditoria / Logs / Notificações / Config / Consentimentos: admin
CREATE POLICY "audit_admin"  ON auditoria          FOR SELECT TO authenticated USING (auth_is_grupo_admin());
CREATE POLICY "logs_admin"   ON logs_acesso        FOR SELECT TO authenticated USING (auth_is_grupo_admin());
CREATE POLICY "notif_read"   ON notificacoes       FOR SELECT TO authenticated USING (auth_is_grupo_admin());
CREATE POLICY "regras_admin" ON regras_notificacao FOR ALL    TO authenticated USING (auth_is_grupo_admin()) WITH CHECK (auth_is_grupo_admin());
CREATE POLICY "conf_admin"   ON configuracoes      FOR ALL    TO authenticated USING (auth_is_grupo_admin()) WITH CHECK (auth_is_grupo_admin());
CREATE POLICY "cons_admin"   ON consentimentos     FOR ALL    TO authenticated USING (auth_is_grupo_admin()) WITH CHECK (auth_is_grupo_admin());

-- ============================================================
-- SEED — dados de referência
-- ============================================================
INSERT INTO empresas (nome, cnpj, tipo) VALUES
  ('Grupo Raman',         NULL,                  'grupo'),
  ('Emprestei Card',      '50.422.605/0001-49',  'originadora'),
  ('PixConsig',           NULL,                  'franqueadora'),
  ('EQT Private Capital', '65.008.789/0001-72',  'investidor')
ON CONFLICT (cnpj) DO NOTHING;

INSERT INTO areas (codigo, nome) VALUES
  ('convenios',   'Convênios'),
  ('crm',         'CRM / Vendas'),
  ('averbacao',   'Averbação'),
  ('formalizacao','Formalização'),
  ('financeiro',  'Financeiro / Recebíveis'),
  ('comissoes',   'Comissões'),
  ('cobranca',    'Cobrança'),
  ('cessao_fidc', 'Cessão / FIDC'),
  ('juridico',    'Jurídico / Compliance'),
  ('suporte',     'Suporte'),
  ('admin',       'Administração')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO papeis (codigo, nome) VALUES
  ('admin_sistema',    'Admin do Sistema'),
  ('admin_diretoria',  'Admin / Diretoria'),
  ('diretor_area',     'Diretor de Área'),
  ('gestor_area',      'Gestor de Área'),
  ('lider',            'Líder de Equipe'),
  ('operador',         'Operador'),
  ('backoffice',       'Backoffice'),
  ('corban',           'Corban'),
  ('parceiro_externo', 'Parceiro Externo')
ON CONFLICT (codigo) DO NOTHING;
