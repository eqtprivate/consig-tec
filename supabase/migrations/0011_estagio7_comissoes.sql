-- ============================================================
-- CONSIGTEC — Estágio 7: Comissões (motor de rateio)
-- Regras de comissão por convênio × beneficiário (franquia/líder/
-- corban/operador) e função testável que gera as comissões previstas
-- de um contrato aplicando o rateio. Aplicar após 0010. Idempotente.
-- ============================================================

DO $$ BEGIN CREATE TYPE beneficiario_comissao AS ENUM
  ('franquia','lider','corban','operador','grupo'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------
-- REGRAS DE COMISSÃO
-- convenio_id NULL = regra padrão (global). Regra específica do
-- convênio tem precedência sobre a global para o mesmo beneficiário.
-- base: 'principal' (valor_principal) | 'total' (valor_total)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS regras_comissao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convenio_id uuid REFERENCES convenios(id) ON DELETE CASCADE,
  beneficiario beneficiario_comissao NOT NULL,
  percentual numeric(6,4) NOT NULL,       -- % sobre a base
  base text NOT NULL DEFAULT 'principal',
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (convenio_id, beneficiario)
);
CREATE INDEX IF NOT EXISTS idx_regras_comissao_convenio ON regras_comissao(convenio_id);

DROP TRIGGER IF EXISTS trg_regras_comissao_updated ON regras_comissao;
CREATE TRIGGER trg_regras_comissao_updated BEFORE UPDATE ON regras_comissao FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE regras_comissao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS regras_comissao_read ON regras_comissao;
CREATE POLICY regras_comissao_read ON regras_comissao FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS regras_comissao_admin ON regras_comissao;
CREATE POLICY regras_comissao_admin ON regras_comissao FOR ALL TO authenticated
  USING (auth_is_grupo_admin()) WITH CHECK (auth_is_grupo_admin());

-- comissoes: liga beneficiário e regra usada
ALTER TABLE comissoes ADD COLUMN IF NOT EXISTS beneficiario beneficiario_comissao;
ALTER TABLE comissoes ADD COLUMN IF NOT EXISTS regra_id uuid REFERENCES regras_comissao(id);

-- ------------------------------------------------------------
-- FUNÇÃO: calcular comissões de um contrato (motor de rateio)
-- Aplica as regras ativas (específica do convênio > global) por
-- beneficiário. Idempotente: se já houver comissões, retorna 0.
-- Retorna o número de comissões geradas.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calcular_comissoes_contrato(p_contrato uuid)
RETURNS int
LANGUAGE plpgsql AS $$
DECLARE c contratos; base_val numeric; r record; cnt int := 0;
BEGIN
  SELECT * INTO c FROM contratos WHERE id = p_contrato;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato % não encontrado', p_contrato; END IF;
  IF EXISTS (SELECT 1 FROM comissoes WHERE contrato_id = p_contrato) THEN RETURN 0; END IF;

  FOR r IN
    SELECT DISTINCT ON (beneficiario) *
    FROM regras_comissao
    WHERE ativo AND (convenio_id = c.convenio_id OR convenio_id IS NULL)
    ORDER BY beneficiario, convenio_id NULLS LAST
  LOOP
    base_val := CASE WHEN r.base = 'total' THEN COALESCE(c.valor_total, c.valor_principal) ELSE c.valor_principal END;
    INSERT INTO comissoes (contrato_id, franquia_id, beneficiario, tipo, base_calculo, percentual, valor, status, regra_id)
    VALUES (p_contrato, c.franquia_id, r.beneficiario, r.beneficiario::text, base_val, r.percentual,
            round(base_val * r.percentual / 100.0, 2), 'prevista', r.id);
    cnt := cnt + 1;
  END LOOP;
  RETURN cnt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calcular_comissoes_contrato(uuid) TO authenticated;

-- Seed opcional de regras padrão (global) — só insere se não houver nenhuma.
INSERT INTO regras_comissao (convenio_id, beneficiario, percentual, base, descricao)
SELECT * FROM (VALUES
  (NULL::uuid, 'franquia'::beneficiario_comissao, 2.0::numeric, 'principal', 'Padrão franquia'),
  (NULL::uuid, 'lider'::beneficiario_comissao,    1.0::numeric, 'principal', 'Padrão líder'),
  (NULL::uuid, 'corban'::beneficiario_comissao,   1.5::numeric, 'principal', 'Padrão corban')
) v(convenio_id, beneficiario, percentual, base, descricao)
WHERE NOT EXISTS (SELECT 1 FROM regras_comissao);
