-- ============================================================
-- CONSIGTEC — Estágio 3: Tomadores & Vínculos
-- Múltiplas matrículas (vínculos servidor↔ente) por tomador, com
-- margem apartada por vínculo. A elegibilidade do cartão benefício
-- é derivada (situação + convênio com margem apartada + margem > 0).
-- Fonte da verdade do vínculo continua sendo o cliente (clientes).
-- ============================================================

-- Situação funcional do vínculo
DO $$ BEGIN
  CREATE TYPE situacao_matricula AS ENUM
    ('ativo', 'aposentado', 'pensionista', 'inativo', 'exonerado', 'licenca');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS matriculas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  convenio_id uuid REFERENCES convenios(id),
  matricula text NOT NULL,
  orgao text,                              -- lotação/órgão (pode diferir do ente do convênio)
  cargo text,
  situacao situacao_matricula NOT NULL DEFAULT 'ativo',
  data_admissao date,
  salario_bruto numeric(12,2),
  margem_bruta numeric(12,2),              -- margem apartada bruta do vínculo
  margem_utilizada numeric(12,2) NOT NULL DEFAULT 0,
  margem_disponivel numeric(12,2)
    GENERATED ALWAYS AS (COALESCE(margem_bruta, 0) - COALESCE(margem_utilizada, 0)) STORED,
  observacao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT matriculas_unq UNIQUE (cliente_id, convenio_id, matricula)
);

CREATE INDEX IF NOT EXISTS idx_matriculas_cliente  ON matriculas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_convenio ON matriculas(convenio_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_situacao ON matriculas(situacao);

DROP TRIGGER IF EXISTS trg_matriculas_updated ON matriculas;
CREATE TRIGGER trg_matriculas_updated BEFORE UPDATE ON matriculas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS: escopo herdado do tomador (mesmo padrão de averbacoes/parcelas)
ALTER TABLE matriculas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matriculas_rls ON matriculas;
CREATE POLICY matriculas_rls ON matriculas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM clientes c
                 WHERE c.id = cliente_id AND auth_tem_escopo(c.empresa_id, c.franquia_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM clientes c
                 WHERE c.id = cliente_id AND auth_tem_escopo(c.empresa_id, c.franquia_id)));

-- Elegibilidade do cartão benefício (lógica testável, reutilizável)
CREATE OR REPLACE FUNCTION public.matricula_elegivel_cartao(p_matricula uuid)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM matriculas m
    JOIN convenios cv ON cv.id = m.convenio_id
    WHERE m.id = p_matricula
      AND m.ativo IS TRUE
      AND m.situacao IN ('ativo', 'aposentado', 'pensionista')
      AND cv.tipo_margem IN ('apartada', 'cartao')
      AND COALESCE(m.margem_disponivel, 0) > 0
  );
$$;
