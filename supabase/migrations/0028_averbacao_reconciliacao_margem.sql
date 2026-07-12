-- ============================================================
-- CONSIGTEC — Estágio 4 (robustez): reconciliação da margem na averbação.
-- Fecha o elo reserva↔averbação:
--   averbada            → reserva vira EFETIVADA (ajusta se o valor averbado
--                         divergir do reservado)
--   recusada/cancelada  → LIBERA a margem (devolve ao vínculo)
-- + função reconciliacao_margem() para auditar reservado × averbado.
-- Após 0027. Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- Efetiva a reserva de margem de uma proposta (averbação confirmada).
-- Se p_valor_efetivo diverge do reservado, ajusta margem_utilizada do vínculo.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.efetivar_margem_proposta(p_proposta uuid, p_valor_efetivo numeric DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_res   reservas_margem;
  v_delta numeric;
BEGIN
  SELECT * INTO v_res FROM reservas_margem
   WHERE proposta_id = p_proposta AND status = 'reservada'
   LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  IF p_valor_efetivo IS NOT NULL AND p_valor_efetivo <> v_res.valor THEN
    v_delta := p_valor_efetivo - v_res.valor;   -- >0 consome mais; <0 devolve
    UPDATE matriculas
       SET margem_utilizada = GREATEST(COALESCE(margem_utilizada, 0) + v_delta, 0)
     WHERE id = v_res.matricula_id;
    UPDATE reservas_margem
       SET valor = p_valor_efetivo, status = 'efetivada',
           observacao = COALESCE(observacao, '') || ' | efetivada na averbação'
     WHERE id = v_res.id;
  ELSE
    UPDATE reservas_margem
       SET status = 'efetivada',
           observacao = COALESCE(observacao, '') || ' | efetivada na averbação'
     WHERE id = v_res.id;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.efetivar_margem_proposta(uuid, numeric) TO authenticated;

-- ------------------------------------------------------------
-- Trigger: reconcilia a margem conforme o status da averbação.
-- Aplica-se apenas a averbações ligadas a uma proposta (margem apartada).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_averbacoes_margem_reconcilia()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NEW.proposta_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'averbada' THEN
      PERFORM efetivar_margem_proposta(NEW.proposta_id, NEW.valor_averbado);
    ELSIF NEW.status IN ('recusada', 'cancelada') THEN
      PERFORM liberar_margem_proposta(NEW.proposta_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_averbacoes_margem ON averbacoes;
CREATE TRIGGER trg_averbacoes_margem
  AFTER INSERT OR UPDATE OF status ON averbacoes
  FOR EACH ROW
  EXECUTE FUNCTION fn_averbacoes_margem_reconcilia();

-- ------------------------------------------------------------
-- Relatório de reconciliação: reservado × averbado por proposta.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reconciliacao_margem()
RETURNS TABLE(
  proposta_id uuid,
  cliente text,
  convenio text,
  matricula text,
  valor_reservado numeric,
  status_reserva status_reserva,
  valor_averbado numeric,
  status_averbacao status_averbacao,
  divergencia numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT
    p.id,
    cl.nome,
    cv.nome,
    mt.matricula,
    r.valor,
    r.status,
    a.valor_averbado,
    a.status,
    COALESCE(a.valor_averbado, r.valor) - r.valor AS divergencia
  FROM reservas_margem r
  JOIN propostas p ON p.id = r.proposta_id
  LEFT JOIN clientes cl ON cl.id = p.cliente_id
  LEFT JOIN convenios cv ON cv.id = p.convenio_id
  LEFT JOIN matriculas mt ON mt.id = r.matricula_id
  LEFT JOIN LATERAL (
    SELECT * FROM averbacoes a WHERE a.proposta_id = p.id ORDER BY updated_at DESC LIMIT 1
  ) a ON true
  WHERE r.status IN ('reservada', 'efetivada')
  ORDER BY abs(COALESCE(a.valor_averbado, r.valor) - r.valor) DESC, cl.nome;
$$;
GRANT EXECUTE ON FUNCTION public.reconciliacao_margem() TO authenticated;
