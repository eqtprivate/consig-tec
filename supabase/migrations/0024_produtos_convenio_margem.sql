-- ============================================================
-- CONSIGTEC — Estágio 1/4: parametrização de PRODUTO por convênio
-- (um convênio pode ofertar vários produtos com regras próprias) +
-- base para consulta/simulação de margem apartada. Após 0023. Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS produtos_convenio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convenio_id uuid NOT NULL REFERENCES convenios(id) ON DELETE CASCADE,
  produto produto_consig NOT NULL DEFAULT 'cartao_beneficio',   -- enum de 0018
  nome text,
  tipo_margem tipo_margem,                                       -- enum de 0005
  taxa_mensal numeric(6,4),
  prazo_min int,
  prazo_max int,
  valor_min numeric(12,2),
  valor_max numeric(12,2),
  idade_min int,
  idade_max int,
  margem_percentual numeric(5,2),        -- % da margem apartada que o produto consome
  rotativo boolean NOT NULL DEFAULT true,
  saque_vinculado boolean NOT NULL DEFAULT true,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (convenio_id, produto)
);
CREATE INDEX IF NOT EXISTS idx_produtos_convenio ON produtos_convenio(convenio_id);

DROP TRIGGER IF EXISTS trg_produtos_convenio_updated ON produtos_convenio;
CREATE TRIGGER trg_produtos_convenio_updated BEFORE UPDATE ON produtos_convenio FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE produtos_convenio ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS produtos_convenio_read ON produtos_convenio;
CREATE POLICY produtos_convenio_read ON produtos_convenio FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS produtos_convenio_admin ON produtos_convenio;
CREATE POLICY produtos_convenio_admin ON produtos_convenio FOR ALL TO authenticated
  USING (auth_is_grupo_admin()) WITH CHECK (auth_is_grupo_admin());

-- Seed: 1 produto padrão (cartão benefício) por convênio existente que ainda
-- não tenha produto, herdando os parâmetros do próprio convênio.
INSERT INTO produtos_convenio (convenio_id, produto, nome, tipo_margem, taxa_mensal, prazo_max, margem_percentual, rotativo, saque_vinculado)
SELECT c.id, 'cartao_beneficio', 'Cartão Benefício', c.tipo_margem, c.taxa_mensal, c.prazo_maximo,
       c.percentual_margem_apartada, COALESCE(c.rotativo, true), COALESCE(c.saque_vinculado, true)
FROM convenios c
WHERE NOT EXISTS (SELECT 1 FROM produtos_convenio p WHERE p.convenio_id = c.id);

-- ------------------------------------------------------------
-- FUNÇÃO: valor máximo financiável dada a margem mensal (PMT inverso)
-- principal = PMT * (1 - (1+i)^-n) / i   (i = taxa%/100)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.valor_maximo_por_margem(p_margem numeric, p_taxa_mensal numeric, p_prazo int)
RETURNS numeric
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE i numeric;
BEGIN
  IF p_margem IS NULL OR p_margem <= 0 OR p_prazo IS NULL OR p_prazo <= 0 THEN RETURN 0; END IF;
  i := COALESCE(p_taxa_mensal, 0) / 100.0;
  IF i = 0 THEN RETURN round(p_margem * p_prazo, 2); END IF;
  RETURN round(p_margem * (1 - power(1 + i, -p_prazo)) / i, 2);
END;
$$;
GRANT EXECUTE ON FUNCTION public.valor_maximo_por_margem(numeric, numeric, int) TO authenticated;
