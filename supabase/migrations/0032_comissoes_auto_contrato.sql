-- ============================================================
-- CONSIGTEC — Estágio 7 (automação): provisão automática de comissões.
-- Ao criar um contrato (esteira da CCB ou manual), as comissões previstas
-- são geradas aplicando as regras de rateio (calcular_comissoes_contrato).
-- Base padrão = valor_principal. Após 0031. Idempotente.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_contrato_provisiona_comissoes()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  PERFORM calcular_comissoes_contrato(NEW.id);   -- idempotente (0 se já houver)
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contrato_comissoes ON contratos;
CREATE TRIGGER trg_contrato_comissoes
  AFTER INSERT ON contratos
  FOR EACH ROW
  EXECUTE FUNCTION fn_contrato_provisiona_comissoes();
