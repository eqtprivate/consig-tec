-- ============================================================
-- CONSIGTEC — Item 4: batimento de 2ª camada (repasse perdido) + status vivo
-- por parcela. Desconto realizado (retorno) x repasse recebido → repasse_perdido.
-- Enum status_parcela ganhou parcial/recomprada/baixada (aplicado à parte por
-- restrição transacional do ALTER TYPE). Idempotente.
-- ============================================================
ALTER TABLE public.retornos_folha
  ADD COLUMN IF NOT EXISTS valor_repassado       numeric,
  ADD COLUMN IF NOT EXISTS repasse_recebido_em   timestamptz,
  ADD COLUMN IF NOT EXISTS valor_repasse_perdido numeric;

CREATE OR REPLACE FUNCTION public.conciliar_repasse(p_retorno uuid, p_valor_repassado numeric)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE r retornos_folha; v_desc numeric; v_perd numeric;
BEGIN
  SELECT * INTO r FROM retornos_folha WHERE id = p_retorno;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Retorno não encontrado.'; END IF;
  IF NOT (auth_is_superadmin() OR r.empresa_id = auth_empresa_id()) THEN
    RAISE EXCEPTION 'Fora do escopo da sua empresa.'; END IF;
  v_desc := coalesce(r.valor_conciliado,
                     (SELECT sum(valor_descontado) FROM retorno_itens WHERE retorno_id = p_retorno), 0);
  v_perd := greatest(0, v_desc - coalesce(p_valor_repassado, 0));
  UPDATE retornos_folha SET valor_repassado = p_valor_repassado, repasse_recebido_em = now(),
         valor_repasse_perdido = v_perd WHERE id = p_retorno;
  DELETE FROM conciliacao_ocorrencias WHERE retorno_id = p_retorno AND tipo = 'repasse_perdido';
  IF v_perd > 0 THEN
    INSERT INTO conciliacao_ocorrencias
      (empresa_id, retorno_id, convenio_id, competencia, tipo, valor_esperado, valor_descontado, diferenca, motivo, status)
    VALUES (r.empresa_id, p_retorno, r.convenio_id, r.competencia, 'repasse_perdido',
            v_desc, coalesce(p_valor_repassado,0), v_perd,
            'Descontado em folha mas não repassado pela averbadora (perda pura).', 'aberta');
  END IF;
  RETURN v_perd;
END $$;
GRANT EXECUTE ON FUNCTION public.conciliar_repasse(uuid, numeric) TO authenticated;

-- Status vivo por parcela (prevista/parcial/paga/atrasada); recomprada/baixada
-- são estados manuais preservados.
CREATE OR REPLACE FUNCTION public.tg_parcela_status()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('recomprada','baixada','renegociada') THEN RETURN NEW; END IF;
  IF coalesce(NEW.valor_pago,0) >= NEW.valor AND NEW.valor > 0 THEN NEW.status := 'paga';
  ELSIF coalesce(NEW.valor_pago,0) > 0 THEN NEW.status := 'parcial';
  ELSIF NEW.vencimento < current_date THEN NEW.status := 'atrasada';
  ELSE NEW.status := 'aberta'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_parcela_status ON public.parcelas;
CREATE TRIGGER trg_parcela_status BEFORE INSERT OR UPDATE OF valor_pago, vencimento, valor
  ON public.parcelas FOR EACH ROW EXECUTE FUNCTION tg_parcela_status();
