-- ============================================================
-- CONSIGTEC — Multi-tenant (Fase 8): credenciais PixConsig POR EMPRESA.
-- Cada cliente tem sua própria conta PixConsig (x-api-key). O backend
-- syncPixconsig lê estas credenciais via service_role e grava os convênios
-- com empresa_id = a empresa sincronizada.
-- SEGURANÇA: RLS restrita a superadmin; a api_key fica em repouso no Postgres
-- (criptografado em disco pela Supabase). Endurecer com Vault é um upgrade.
-- Após 0058. Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS pixconsig_credenciais (
  empresa_id uuid PRIMARY KEY REFERENCES empresas(id) ON DELETE CASCADE,
  base_url text,
  api_key text,                 -- x-api-key da PixConsig do cliente
  sync_token text,              -- token do cron por empresa
  ativo boolean NOT NULL DEFAULT true,
  intervalo_horas int NOT NULL DEFAULT 4,
  hora_inicio int NOT NULL DEFAULT 9,
  hora_fim int NOT NULL DEFAULT 17,
  ultima_sincronizacao timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_pixcred_updated ON pixconsig_credenciais;
CREATE TRIGGER trg_pixcred_updated BEFORE UPDATE ON pixconsig_credenciais FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE pixconsig_credenciais ENABLE ROW LEVEL SECURITY;
-- Só superadmin gerencia as credenciais (CONSIGTEC). O backend usa service_role.
DROP POLICY IF EXISTS pixcred_admin ON pixconsig_credenciais;
CREATE POLICY pixcred_admin ON pixconsig_credenciais FOR ALL TO authenticated
  USING (auth_is_superadmin()) WITH CHECK (auth_is_superadmin());

-- Semente: a EmpresteiCard herda as credenciais globais atuais (as do backend
-- continuam valendo como fallback). Registro em branco só para aparecer na UI.
INSERT INTO pixconsig_credenciais (empresa_id, base_url, ativo)
SELECT (valor #>> '{}')::uuid, NULL, true
FROM configuracoes WHERE chave = 'empresa_raiz'
ON CONFLICT (empresa_id) DO NOTHING;

-- Visão sem expor a api_key (para telas/listagens): mostra só se está configurada.
CREATE OR REPLACE FUNCTION public.pixconsig_credenciais_status()
RETURNS TABLE(empresa_id uuid, empresa text, base_url text, tem_key boolean, ativo boolean, ultima_sincronizacao timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT c.empresa_id, e.nome, c.base_url, (c.api_key IS NOT NULL AND c.api_key <> ''), c.ativo, c.ultima_sincronizacao
  FROM pixconsig_credenciais c JOIN empresas e ON e.id = c.empresa_id
  WHERE auth_is_superadmin()
  ORDER BY e.nome;
$$;
GRANT EXECUTE ON FUNCTION public.pixconsig_credenciais_status() TO authenticated;
