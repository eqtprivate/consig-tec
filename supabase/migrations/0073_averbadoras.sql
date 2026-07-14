-- ============================================================
-- CONSIGTEC — BPO Fase 2: AVERBADORAS (portais/empregadores) + vínculo com o
-- convênio. Parametriza a empresa averbadora, o portal, o tipo de integração
-- (manual/rpa/api/ftp) e os layouts. Base para o monitor de captura e a prévia.
-- Após 0072. Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS averbadoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES empresas(id),
  nome text NOT NULL,
  cnpj text,
  portal_url text,
  tipo_integracao text NOT NULL DEFAULT 'manual',  -- manual | rpa | api | ftp
  dia_retorno int,                                 -- dia do mês previsto do arquivo de retorno
  dia_previa int,                                  -- dia do mês de envio da prévia
  contato text,
  observacao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_averbadoras_empresa ON averbadoras (empresa_id);
DROP TRIGGER IF EXISTS trg_averbadoras_empresa ON averbadoras;
CREATE TRIGGER trg_averbadoras_empresa BEFORE INSERT ON averbadoras FOR EACH ROW EXECUTE FUNCTION set_empresa_do_autor();
DROP TRIGGER IF EXISTS trg_averbadoras_updated ON averbadoras;
CREATE TRIGGER trg_averbadoras_updated BEFORE UPDATE ON averbadoras FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE averbadoras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS averbadoras_rls ON averbadoras;
CREATE POLICY averbadoras_rls ON averbadoras FOR ALL TO authenticated
  USING (auth_is_superadmin() OR empresa_id = auth_empresa_id())
  WITH CHECK (auth_is_superadmin() OR empresa_id = auth_empresa_id());

-- Vínculo do convênio com a averbadora que o processa.
ALTER TABLE convenios ADD COLUMN IF NOT EXISTS averbadora_id uuid REFERENCES averbadoras(id);
CREATE INDEX IF NOT EXISTS idx_convenios_averbadora ON convenios (averbadora_id);
