-- ============================================================
-- CONSIGTEC — Estágio 4: Margem & Averbação
-- - Proposta passa a referenciar a MATRÍCULA (vínculo) usada.
-- - Reserva de margem apartada (funções testáveis reservar/liberar),
--   com registro auditável em reservas_margem e reflexo em
--   matriculas.margem_utilizada.
-- - Averbação passa a poder nascer da PROPOSTA (pré-contrato), com
--   protocolo/handoff UY3. contrato_id vira opcional.
-- Aplicar após 0006. Idempotente.
-- ============================================================

DO $$ BEGIN
  CREATE TYPE status_reserva AS ENUM ('reservada', 'efetivada', 'liberada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------
-- Proposta -> matrícula (vínculo) + campo de averbação/handoff
-- ------------------------------------------------------------
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS matricula_id uuid REFERENCES matriculas(id);
CREATE INDEX IF NOT EXISTS idx_propostas_matricula ON propostas(matricula_id);

-- ------------------------------------------------------------
-- Averbação: pode referenciar proposta e matrícula; contrato opcional
-- ------------------------------------------------------------
ALTER TABLE averbacoes ADD COLUMN IF NOT EXISTS proposta_id uuid REFERENCES propostas(id) ON DELETE CASCADE;
ALTER TABLE averbacoes ADD COLUMN IF NOT EXISTS matricula_id uuid REFERENCES matriculas(id);
ALTER TABLE averbacoes ADD COLUMN IF NOT EXISTS protocolo_uy3 text;
ALTER TABLE averbacoes ADD COLUMN IF NOT EXISTS valor_averbado numeric(12,2);
ALTER TABLE averbacoes ALTER COLUMN contrato_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_averbacoes_proposta ON averbacoes(proposta_id);

-- RLS de averbacoes: contrato OU proposta no escopo do usuário
DROP POLICY IF EXISTS averbacoes_rls ON averbacoes;
CREATE POLICY averbacoes_rls ON averbacoes FOR ALL TO authenticated
  USING (
    (contrato_id IS NOT NULL AND EXISTS (SELECT 1 FROM contratos c WHERE c.id = contrato_id AND auth_tem_escopo(c.empresa_id, c.franquia_id)))
    OR (proposta_id IS NOT NULL AND EXISTS (SELECT 1 FROM propostas p WHERE p.id = proposta_id AND auth_tem_escopo(p.empresa_id, p.franquia_id)))
  )
  WITH CHECK (
    (contrato_id IS NOT NULL AND EXISTS (SELECT 1 FROM contratos c WHERE c.id = contrato_id AND auth_tem_escopo(c.empresa_id, c.franquia_id)))
    OR (proposta_id IS NOT NULL AND EXISTS (SELECT 1 FROM propostas p WHERE p.id = proposta_id AND auth_tem_escopo(p.empresa_id, p.franquia_id)))
  );

-- ------------------------------------------------------------
-- Reservas de margem (registro auditável)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservas_margem (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matricula_id uuid NOT NULL REFERENCES matriculas(id) ON DELETE CASCADE,
  proposta_id uuid REFERENCES propostas(id) ON DELETE CASCADE,
  valor numeric(12,2) NOT NULL,
  status status_reserva NOT NULL DEFAULT 'reservada',
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reservas_matricula ON reservas_margem(matricula_id);
CREATE INDEX IF NOT EXISTS idx_reservas_proposta ON reservas_margem(proposta_id);
-- Uma reserva ativa por proposta
CREATE UNIQUE INDEX IF NOT EXISTS uq_reserva_proposta_ativa
  ON reservas_margem(proposta_id) WHERE status = 'reservada';

DROP TRIGGER IF EXISTS trg_reservas_updated ON reservas_margem;
CREATE TRIGGER trg_reservas_updated BEFORE UPDATE ON reservas_margem
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE reservas_margem ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reservas_rls ON reservas_margem;
CREATE POLICY reservas_rls ON reservas_margem FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM matriculas m JOIN clientes c ON c.id = m.cliente_id
                 WHERE m.id = matricula_id AND auth_tem_escopo(c.empresa_id, c.franquia_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM matriculas m JOIN clientes c ON c.id = m.cliente_id
                 WHERE m.id = matricula_id AND auth_tem_escopo(c.empresa_id, c.franquia_id)));

-- ------------------------------------------------------------
-- FUNÇÃO: reservar margem de uma proposta (testável)
-- Reserva o valor_parcela na matrícula da proposta, se houver
-- margem disponível. Idempotente por proposta (não duplica reserva).
-- Retorna a linha da reserva.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reservar_margem_proposta(p_proposta uuid)
RETURNS reservas_margem
LANGUAGE plpgsql AS $$
DECLARE
  v_mat uuid;
  v_valor numeric(12,2);
  v_disp numeric(12,2);
  v_res reservas_margem;
BEGIN
  SELECT matricula_id, COALESCE(valor_parcela, 0)
    INTO v_mat, v_valor
  FROM propostas WHERE id = p_proposta;

  IF v_mat IS NULL THEN
    RAISE EXCEPTION 'Proposta % não possui matrícula (vínculo) definida.', p_proposta;
  END IF;
  IF v_valor <= 0 THEN
    RAISE EXCEPTION 'Proposta % não possui valor de parcela para reservar.', p_proposta;
  END IF;

  -- Já existe reserva ativa para esta proposta? retorna-a.
  SELECT * INTO v_res FROM reservas_margem
   WHERE proposta_id = p_proposta AND status = 'reservada' LIMIT 1;
  IF FOUND THEN
    RETURN v_res;
  END IF;

  SELECT margem_disponivel INTO v_disp FROM matriculas WHERE id = v_mat FOR UPDATE;
  IF COALESCE(v_disp, 0) < v_valor THEN
    RAISE EXCEPTION 'Margem insuficiente: disponível %, necessário %.', COALESCE(v_disp,0), v_valor;
  END IF;

  UPDATE matriculas SET margem_utilizada = COALESCE(margem_utilizada,0) + v_valor
   WHERE id = v_mat;

  INSERT INTO reservas_margem (matricula_id, proposta_id, valor, status, observacao)
  VALUES (v_mat, p_proposta, v_valor, 'reservada', 'Reserva automática da proposta')
  RETURNING * INTO v_res;

  RETURN v_res;
END;
$$;

-- ------------------------------------------------------------
-- FUNÇÃO: liberar a reserva de margem de uma proposta
-- Devolve a margem à matrícula. Usada em recusa/cancelamento.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.liberar_margem_proposta(p_proposta uuid)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_res reservas_margem;
BEGIN
  SELECT * INTO v_res FROM reservas_margem
   WHERE proposta_id = p_proposta AND status = 'reservada' LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE matriculas SET margem_utilizada = GREATEST(COALESCE(margem_utilizada,0) - v_res.valor, 0)
   WHERE id = v_res.matricula_id;

  UPDATE reservas_margem SET status = 'liberada' WHERE id = v_res.id;
END;
$$;
