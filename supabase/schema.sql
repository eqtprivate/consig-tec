-- ============================================================
-- CONSIGTEC — Schema de Banco de Dados (Estágio 0)
-- Grupo Raman — Plataforma de Crédito Consignado
-- Execute no SQL Editor do Supabase
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- EMPRESAS (Grupo Raman)
-- ============================================================
CREATE TABLE IF NOT EXISTS empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  cnpj text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO empresas (nome, slug) VALUES
  ('Emprestei Card', 'emprestei-card'),
  ('PixConsig', 'pixconsig'),
  ('EQT Private', 'eqt-private')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- ÁREAS DO PROCESSO
-- ============================================================
CREATE TABLE IF NOT EXISTS areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  descricao text,
  icone text,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO areas (nome, slug, descricao, ordem) VALUES
  ('Convênios', 'convenios', 'Gestão de convênios e parcerias', 1),
  ('CRM / Vendas', 'crm-vendas', 'Relacionamento e vendas', 2),
  ('Averbação', 'averbacao', 'Processo de averbação', 3),
  ('Formalização', 'formalizacao', 'Formalização de contratos', 4),
  ('Financeiro / Recebíveis', 'financeiro', 'Gestão financeira e recebíveis', 5),
  ('Comissões', 'comissoes', 'Cálculo e pagamento de comissões', 6),
  ('Cobrança', 'cobranca', 'Gestão de cobrança', 7),
  ('Cessão / FIDC', 'cessao-fidc', 'Cessão de crédito e FIDC', 8),
  ('Jurídico / Compliance', 'juridico', 'Jurídico e compliance', 9),
  ('Suporte', 'suporte', 'Suporte operacional', 10),
  ('Admin', 'admin', 'Administração do sistema', 11)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- UNIDADES (Franquia / Unidade)
-- ============================================================
CREATE TABLE IF NOT EXISTS unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  nome text NOT NULL,
  codigo text NOT NULL UNIQUE,
  tipo text NOT NULL DEFAULT 'unidade' CHECK (tipo IN ('matriz', 'franquia', 'unidade')),
  cidade text,
  uf char(2),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- USUÁRIOS (perfil estendido de auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL UNIQUE,
  cargo text,
  telefone text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger: criar perfil automaticamente no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.usuarios (auth_user_id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- VÍNCULOS (usuário × unidade × área × papel)
-- ============================================================
CREATE TABLE IF NOT EXISTS vinculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  area_id uuid NOT NULL REFERENCES areas(id) ON DELETE RESTRICT,
  papel text NOT NULL CHECK (papel IN ('admin', 'diretor_area', 'lider', 'corban', 'operador', 'suporte')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(usuario_id, unidade_id, area_id)
);

-- ============================================================
-- PENDÊNCIAS
-- ============================================================
CREATE TABLE IF NOT EXISTS pendencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  area_id uuid REFERENCES areas(id) ON DELETE SET NULL,
  unidade_id uuid REFERENCES unidades(id) ON DELETE SET NULL,
  responsavel_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  prioridade text NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta', 'critica')),
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'em_andamento', 'concluida', 'cancelada')),
  sla_data timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- LOGS DE AUDITORIA
-- ============================================================
CREATE TABLE IF NOT EXISTS logs_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  usuario_nome text,
  acao text NOT NULL,
  entidade text,
  entidade_id text,
  detalhes jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_vinculos_usuario ON vinculos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_vinculos_unidade ON vinculos(unidade_id);
CREATE INDEX IF NOT EXISTS idx_vinculos_area ON vinculos(area_id);
CREATE INDEX IF NOT EXISTS idx_pendencias_area ON pendencias(area_id);
CREATE INDEX IF NOT EXISTS idx_pendencias_unidade ON pendencias(unidade_id);
CREATE INDEX IF NOT EXISTS idx_pendencias_status ON pendencias(status);
CREATE INDEX IF NOT EXISTS idx_pendencias_prioridade ON pendencias(prioridade);
CREATE INDEX IF NOT EXISTS idx_logs_usuario ON logs_auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_logs_created ON logs_auditoria(created_at DESC);

-- ============================================================
-- TRIGGER updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER empresas_updated BEFORE UPDATE ON empresas FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER unidades_updated BEFORE UPDATE ON unidades FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER usuarios_updated BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER vinculos_updated BEFORE UPDATE ON vinculos FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER pendencias_updated BEFORE UPDATE ON pendencias FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE vinculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pendencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_auditoria ENABLE ROW LEVEL SECURITY;

-- Helper: verifica se o usuário autenticado é admin
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios u
    JOIN vinculos v ON v.usuario_id = u.id
    WHERE u.auth_user_id = auth.uid()
      AND v.papel = 'admin'
      AND v.ativo = true
  );
$$;

-- Empresas e áreas: leitura para todos autenticados
CREATE POLICY "empresas_read" ON empresas FOR SELECT TO authenticated USING (true);
CREATE POLICY "areas_read" ON areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "unidades_read" ON unidades FOR SELECT TO authenticated USING (true);

-- Usuários: cada um vê o próprio perfil; admins veem/atualizam todos
CREATE POLICY "usuarios_self_read" ON usuarios FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR public.is_current_user_admin());
CREATE POLICY "usuarios_admin_update" ON usuarios FOR UPDATE TO authenticated
  USING (public.is_current_user_admin());

-- Vínculos: cada um vê os próprios; admins veem/gerenciam todos
CREATE POLICY "vinculos_read" ON vinculos FOR SELECT TO authenticated
  USING (
    usuario_id IN (SELECT id FROM usuarios WHERE auth_user_id = auth.uid())
    OR public.is_current_user_admin()
  );
CREATE POLICY "vinculos_admin_all" ON vinculos FOR ALL TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- Pendências: usuários veem as da sua unidade; admins veem tudo
CREATE POLICY "pendencias_read" ON pendencias FOR SELECT TO authenticated
  USING (
    public.is_current_user_admin()
    OR unidade_id IN (
      SELECT v.unidade_id FROM usuarios u
      JOIN vinculos v ON v.usuario_id = u.id
      WHERE u.auth_user_id = auth.uid() AND v.ativo = true
    )
  );
CREATE POLICY "pendencias_write" ON pendencias FOR ALL TO authenticated
  USING (
    public.is_current_user_admin()
    OR unidade_id IN (
      SELECT v.unidade_id FROM usuarios u
      JOIN vinculos v ON v.usuario_id = u.id
      WHERE u.auth_user_id = auth.uid() AND v.ativo = true
    )
  )
  WITH CHECK (
    public.is_current_user_admin()
    OR unidade_id IN (
      SELECT v.unidade_id FROM usuarios u
      JOIN vinculos v ON v.usuario_id = u.id
      WHERE u.auth_user_id = auth.uid() AND v.ativo = true
    )
  );

-- Logs: qualquer autenticado pode inserir; apenas admin lê
CREATE POLICY "logs_insert" ON logs_auditoria FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "logs_admin_read" ON logs_auditoria FOR SELECT TO authenticated
  USING (public.is_current_user_admin());

-- ============================================================
-- SEED: Unidade Matriz (exemplo)
-- ============================================================
INSERT INTO unidades (empresa_id, nome, codigo, tipo, cidade, uf)
SELECT id, 'Matriz', 'MAT-001', 'matriz', 'São Paulo', 'SP'
FROM empresas WHERE slug = 'emprestei-card'
ON CONFLICT (codigo) DO NOTHING;