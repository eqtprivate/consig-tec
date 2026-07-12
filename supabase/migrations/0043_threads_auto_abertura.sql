-- ============================================================
-- CONSIGTEC — Abertura automática de threads a partir de eventos de sistema.
-- Averbação recusada e repasse divergente já nascem como chamado ancorado ao
-- registro, com categoria e área resolvidas. Após 0042. Idempotente.
-- ============================================================

-- Threads de sistema não têm solicitante humano.
ALTER TABLE threads ALTER COLUMN solicitante_id DROP NOT NULL;

-- Evita duplicar: só abre se não houver thread ativa para o mesmo registro/categoria.
CREATE OR REPLACE FUNCTION public.thread_ativa_existe(p_ref text, p_reg text, p_cat thread_categoria)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM threads
     WHERE entidade_ref = p_ref AND registro_id = p_reg AND categoria = p_cat
       AND status NOT IN ('resolvido','encerrado','cancelado')
  );
$$;

-- ------------------------------------------------------------
-- Averbação recusada → abre chamado (categoria averbacao) ancorado à averbação.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_thread_averbacao_recusada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_area uuid; v_franquia uuid; v_nome text;
BEGIN
  IF NEW.status = 'recusada' AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status)
     AND NOT thread_ativa_existe('averbacoes', NEW.id::text, 'averbacao') THEN
    SELECT id INTO v_area FROM areas WHERE codigo = 'averbacao' LIMIT 1;
    IF v_area IS NULL THEN RETURN NEW; END IF;
    SELECT p.franquia_id, c.nome INTO v_franquia, v_nome
      FROM propostas p LEFT JOIN clientes c ON c.id = p.cliente_id WHERE p.id = NEW.proposta_id;
    PERFORM abrir_thread('chamado', 'averbacao',
      'Averbação recusada' || COALESCE(' — ' || v_nome, ''),
      COALESCE(NEW.motivo_recusa, 'Averbação recusada pelo convênio. Verificar e reprocessar.'),
      'averbacoes', NEW.id::text, v_area, NULL, v_franquia, NULL, NULL, 'alta', false, NULL);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_thread_averbacao_recusada ON averbacoes;
CREATE TRIGGER trg_thread_averbacao_recusada AFTER INSERT OR UPDATE OF status ON averbacoes
  FOR EACH ROW EXECUTE FUNCTION trg_thread_averbacao_recusada();

-- ------------------------------------------------------------
-- Repasse divergente (recebido ≠ previsto) → abre chamado (recebivel_pmt).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_thread_repasse_divergente()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_area uuid; v_div boolean;
BEGIN
  v_div := (NEW.status = 'divergente')
        OR (NEW.valor_previsto IS NOT NULL AND NEW.valor_recebido IS NOT NULL
            AND NEW.valor_recebido <> NEW.valor_previsto);
  IF v_div AND NOT thread_ativa_existe('repasses_folha', NEW.id::text, 'recebivel_pmt') THEN
    SELECT id INTO v_area FROM areas WHERE codigo = 'financeiro' LIMIT 1;
    IF v_area IS NULL THEN RETURN NEW; END IF;
    PERFORM abrir_thread('chamado', 'recebivel_pmt',
      'Repasse divergente — ' || COALESCE(NEW.competencia, ''),
      'Previsto ' || COALESCE(NEW.valor_previsto::text, '—') || ' × recebido ' || COALESCE(NEW.valor_recebido::text, '—') || '. Conciliar.',
      'repasses_folha', NEW.id::text, v_area, NULL, NEW.franquia_id, NULL, NULL, 'alta', false, NULL);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_thread_repasse_divergente ON repasses_folha;
CREATE TRIGGER trg_thread_repasse_divergente AFTER INSERT OR UPDATE ON repasses_folha
  FOR EACH ROW EXECUTE FUNCTION trg_thread_repasse_divergente();
