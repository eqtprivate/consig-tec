-- ============================================================
-- CONSIGTEC — Estágio 6: Motor de PMT & Conciliação
-- Funções testáveis de PMT (tabela Price) que geram o cronograma de
-- parcelas de um contrato, + camada de conciliação de repasse/folha
-- (previsto × recebido). Aplicar após 0009. Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- calcular_pmt: parcela pela tabela Price. Taxa em % ao mês.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calcular_pmt(p_principal numeric, p_taxa_mensal numeric, p_prazo int)
RETURNS numeric
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE i numeric;
BEGIN
  IF p_prazo IS NULL OR p_prazo <= 0 OR p_principal IS NULL THEN RETURN NULL; END IF;
  i := COALESCE(p_taxa_mensal, 0) / 100.0;
  IF i = 0 THEN
    RETURN round(p_principal / p_prazo, 2);
  END IF;
  RETURN round(p_principal * i / (1 - power(1 + i, -p_prazo)), 2);
END;
$$;

-- ------------------------------------------------------------
-- simular_pmt: cronograma completo (juros/amortização/saldo) sem persistir.
-- Ajusta a última parcela para zerar o saldo.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.simular_pmt(
  p_principal numeric, p_taxa_mensal numeric, p_prazo int, p_data_base date DEFAULT current_date)
RETURNS TABLE(numero int, vencimento date, valor numeric, juros numeric, amortizacao numeric, saldo numeric)
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE i numeric; pmt numeric; s numeric; k int; jr numeric; am numeric;
BEGIN
  IF p_prazo IS NULL OR p_prazo <= 0 THEN RETURN; END IF;
  i := COALESCE(p_taxa_mensal, 0) / 100.0;
  pmt := calcular_pmt(p_principal, p_taxa_mensal, p_prazo);
  s := p_principal;
  FOR k IN 1..p_prazo LOOP
    jr := round(s * i, 2);
    IF k = p_prazo THEN
      am := s;                 -- última amortiza todo o saldo restante
    ELSE
      am := round(pmt - jr, 2);
    END IF;
    s := round(s - am, 2);
    numero := k;
    vencimento := (p_data_base + (k || ' months')::interval)::date;
    juros := jr; amortizacao := am; valor := round(am + jr, 2); saldo := s;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- ------------------------------------------------------------
-- gerar_cronograma_contrato: gera as parcelas do contrato via PMT.
-- Idempotente: se já houver parcelas, retorna 0. Atualiza
-- valor_parcela/valor_total do contrato. Retorna nº de parcelas geradas.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gerar_cronograma_contrato(p_contrato uuid)
RETURNS int
LANGUAGE plpgsql AS $$
DECLARE c contratos; base date; r record; cnt int := 0;
BEGIN
  SELECT * INTO c FROM contratos WHERE id = p_contrato;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato % não encontrado', p_contrato; END IF;
  IF EXISTS (SELECT 1 FROM parcelas WHERE contrato_id = p_contrato) THEN RETURN 0; END IF;

  base := COALESCE(c.data_assinatura, current_date);
  FOR r IN SELECT * FROM simular_pmt(c.valor_principal, COALESCE(c.taxa_mensal, 0), c.prazo, base) LOOP
    INSERT INTO parcelas (contrato_id, numero, vencimento, valor, status)
    VALUES (p_contrato, r.numero, r.vencimento, r.valor, 'aberta');
    cnt := cnt + 1;
  END LOOP;

  UPDATE contratos
     SET valor_parcela = calcular_pmt(c.valor_principal, COALESCE(c.taxa_mensal, 0), c.prazo),
         valor_total   = (SELECT COALESCE(sum(valor), 0) FROM parcelas WHERE contrato_id = p_contrato)
   WHERE id = p_contrato;
  RETURN cnt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calcular_pmt(numeric, numeric, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.simular_pmt(numeric, numeric, int, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gerar_cronograma_contrato(uuid) TO authenticated;

-- ------------------------------------------------------------
-- CONCILIAÇÃO DE REPASSE / FOLHA (previsto × recebido)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS repasses_folha (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convenio_id uuid REFERENCES convenios(id),
  franquia_id uuid REFERENCES franquias(id),
  competencia text NOT NULL,                 -- 'YYYY-MM'
  valor_previsto numeric(14,2),
  valor_recebido numeric(14,2),
  arquivo_cnab text,                         -- referência ao CNAB444 de retorno
  status text NOT NULL DEFAULT 'pendente',   -- pendente | conciliado | divergente
  conciliado_em timestamptz,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (convenio_id, franquia_id, competencia)
);
CREATE INDEX IF NOT EXISTS idx_repasses_competencia ON repasses_folha(competencia);
CREATE INDEX IF NOT EXISTS idx_repasses_franquia ON repasses_folha(franquia_id);

DROP TRIGGER IF EXISTS trg_repasses_updated ON repasses_folha;
CREATE TRIGGER trg_repasses_updated BEFORE UPDATE ON repasses_folha FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE repasses_folha ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS repasses_rls ON repasses_folha;
CREATE POLICY repasses_rls ON repasses_folha FOR ALL TO authenticated
  USING (auth_is_grupo_admin() OR auth_tem_escopo(NULL, franquia_id))
  WITH CHECK (auth_is_grupo_admin() OR auth_tem_escopo(NULL, franquia_id));
