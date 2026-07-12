-- ============================================================
-- CONSIGTEC — Ciclo de vida da margem: liberação automática.
-- Quando a proposta é REPROVADA ou CANCELADA, a reserva de margem é
-- liberada automaticamente (devolve a margem ao vínculo), independentemente
-- de onde a mudança de status veio. Espelho da reserva feita ao gerar.
-- Após 0026. Idempotente.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_propostas_margem_lifecycle()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  -- Libera a margem quando a proposta entra em estado terminal negativo.
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('reprovada', 'cancelada') THEN
    PERFORM liberar_margem_proposta(NEW.id);   -- idempotente (só age se houver reserva ativa)
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propostas_margem ON propostas;
CREATE TRIGGER trg_propostas_margem
  AFTER UPDATE OF status ON propostas
  FOR EACH ROW
  EXECUTE FUNCTION fn_propostas_margem_lifecycle();

-- Também libera se a proposta for apagada com reserva ativa (limpeza).
CREATE OR REPLACE FUNCTION public.fn_propostas_margem_delete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  PERFORM liberar_margem_proposta(OLD.id);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_propostas_margem_del ON propostas;
CREATE TRIGGER trg_propostas_margem_del
  BEFORE DELETE ON propostas
  FOR EACH ROW
  EXECUTE FUNCTION fn_propostas_margem_delete();
