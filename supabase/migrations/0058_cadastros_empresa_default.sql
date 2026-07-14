-- ============================================================
-- CONSIGTEC — Multi-tenant (Fase 7): carimbo automático de empresa nos
-- cadastros manuais. "Convênios por empresa": ao inserir convênio/cliente sem
-- empresa_id, grava a empresa do AUTOR (auth_empresa_id). O sync PixConsig
-- (service_role) continua definindo empresa_id explicitamente (por-tenant).
-- Após 0057. Idempotente.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_empresa_do_autor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NEW.empresa_id IS NULL THEN
    NEW.empresa_id := auth_empresa_id();  -- null p/ service_role (sync define explícito)
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_convenios_empresa ON convenios;
CREATE TRIGGER trg_convenios_empresa BEFORE INSERT ON convenios
  FOR EACH ROW EXECUTE FUNCTION set_empresa_do_autor();

DROP TRIGGER IF EXISTS trg_clientes_empresa ON clientes;
CREATE TRIGGER trg_clientes_empresa BEFORE INSERT ON clientes
  FOR EACH ROW EXECUTE FUNCTION set_empresa_do_autor();
