-- ============================================================
-- CONSIGTEC — Multi-tenant (Fase 3: PLANOS DE ACESSO).
-- Planos por empresa: limitam VOLUME (usuários/convênios/propostas — só avisam)
-- e MÓDULOS (áreas liberadas — controlam o que aparece). Seed Starter/Pro/
-- Enterprise. EmpresteiCard entra como Enterprise. Após 0053. Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text UNIQUE NOT NULL,
  nome text NOT NULL,
  descricao text,
  limite_usuarios int,          -- NULL = ilimitado
  limite_convenios int,         -- NULL = ilimitado
  limite_propostas_mes int,     -- NULL = ilimitado
  modulos text[] NOT NULL DEFAULT '{}',  -- códigos de áreas; '*' = todas
  preco_mensal numeric(12,2),
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_planos_updated ON planos;
CREATE TRIGGER trg_planos_updated BEFORE UPDATE ON planos FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE empresas ADD COLUMN IF NOT EXISTS plano_id uuid REFERENCES planos(id);
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS plano_desde date;

-- Seed dos planos (idempotente por codigo).
INSERT INTO planos (codigo, nome, descricao, limite_usuarios, limite_convenios, limite_propostas_mes, modulos, preco_mensal, ordem) VALUES
  ('starter', 'Starter', 'Entrada — originação básica', 5, 50, 200,
     ARRAY['convenios','crm','suporte'], 0, 1),
  ('pro', 'Pro', 'Operação completa de crédito', 25, 300, 2000,
     ARRAY['convenios','crm','averbacao','formalizacao','financeiro','cobranca','suporte'], 0, 2),
  ('enterprise', 'Enterprise', 'Tudo liberado, sem limites', NULL, NULL, NULL,
     ARRAY['*'], 0, 3)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome, descricao = EXCLUDED.descricao,
  limite_usuarios = EXCLUDED.limite_usuarios, limite_convenios = EXCLUDED.limite_convenios,
  limite_propostas_mes = EXCLUDED.limite_propostas_mes, modulos = EXCLUDED.modulos, ordem = EXCLUDED.ordem;

-- EmpresteiCard (empresa raiz) = Enterprise.
UPDATE empresas SET plano_id = (SELECT id FROM planos WHERE codigo = 'enterprise'), plano_desde = coalesce(plano_desde, current_date)
WHERE id = (SELECT (valor #>> '{}')::uuid FROM configuracoes WHERE chave = 'empresa_raiz');

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE planos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS planos_read ON planos;
CREATE POLICY planos_read ON planos FOR SELECT TO authenticated USING (true);         -- catálogo visível
DROP POLICY IF EXISTS planos_admin ON planos;
CREATE POLICY planos_admin ON planos FOR ALL TO authenticated
  USING (auth_is_superadmin()) WITH CHECK (auth_is_superadmin());                     -- só CONSIGTEC edita

-- empresas: faltava política de escrita — criar/editar empresa e atribuir plano é superadmin.
DROP POLICY IF EXISTS empresas_admin ON empresas;
CREATE POLICY empresas_admin ON empresas FOR ALL TO authenticated
  USING (auth_is_superadmin()) WITH CHECK (auth_is_superadmin());

-- ------------------------------------------------------------
-- Helpers de entitlement (módulos)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_plano_tem_modulo(p_area text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE mods text[];
BEGIN
  IF auth_is_superadmin() THEN RETURN true; END IF;
  SELECT p.modulos INTO mods FROM empresas e JOIN planos p ON p.id = e.plano_id WHERE e.id = auth_empresa_id();
  IF mods IS NULL THEN RETURN true; END IF;  -- empresa sem plano definido: não bloqueia
  RETURN ('*' = ANY(mods)) OR (p_area = ANY(mods));
END $$;
GRANT EXECUTE ON FUNCTION public.auth_plano_tem_modulo(text) TO authenticated;

-- Uso × limites da empresa do usuário (para o painel/avisos). Só informa.
CREATE OR REPLACE FUNCTION public.plano_uso_empresa()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE emp uuid; v_plano jsonb; v_usuarios int; v_convenios int; v_propostas int;
BEGIN
  emp := auth_empresa_id();
  IF emp IS NULL THEN RETURN NULL; END IF;

  SELECT to_jsonb(p) INTO v_plano FROM planos p JOIN empresas e ON e.plano_id = p.id WHERE e.id = emp;
  SELECT count(*) INTO v_usuarios FROM usuarios WHERE empresa_id = emp;
  SELECT count(*) INTO v_convenios FROM convenios WHERE empresa_id = emp;
  SELECT count(*) INTO v_propostas FROM propostas WHERE empresa_id = emp AND created_at >= date_trunc('month', now());

  RETURN jsonb_build_object(
    'plano', v_plano,
    'uso', jsonb_build_object('usuarios', v_usuarios, 'convenios', v_convenios, 'propostas_mes', v_propostas)
  );
END $$;
GRANT EXECUTE ON FUNCTION public.plano_uso_empresa() TO authenticated;
