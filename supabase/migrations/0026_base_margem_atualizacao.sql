-- ============================================================
-- CONSIGTEC — Estágio 1: atualização da BASE DE MARGEM (modo offline/batch).
-- Sem integração online, a margem é um espelho local alimentado pelo arquivo
-- periódico da averbadora. Carimbo de "atualizada em" + reconciliação em lote.
-- Após 0025. Idempotente.
-- ============================================================

ALTER TABLE matriculas ADD COLUMN IF NOT EXISTS margem_atualizada_em timestamptz;

-- ------------------------------------------------------------
-- FUNÇÃO: atualização em lote da base de margem de um convênio.
-- Recebe um array JSON [{cpf, matricula?, margem, situacao?, salario?}].
-- Casa por CPF (+ matrícula, se informada) dentro do convênio, atualiza
-- margem_bruta e carimba margem_atualizada_em. A margem já reservada
-- (margem_utilizada) é preservada — a disponível recalcula sozinha.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.atualizar_margem_lote(p_convenio uuid, p_itens jsonb)
RETURNS TABLE(atualizados int, nao_encontrados int, ignorados int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  it       jsonb;
  v_cpf    text;
  v_mat    text;
  v_margem numeric;
  v_sit    text;
  v_sit_e  situacao_matricula;
  v_sal    numeric;
  v_cli    uuid;
  v_rows   int;
  v_upd    int := 0;
  v_miss   int := 0;
  v_ign    int := 0;
BEGIN
  IF NOT (auth_is_grupo_admin() OR auth_is_superadmin()) THEN
    RAISE EXCEPTION 'Sem permissão para atualizar base de margem.';
  END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_cpf    := regexp_replace(COALESCE(it->>'cpf', ''), '\D', '', 'g');
    v_mat    := NULLIF(TRIM(COALESCE(it->>'matricula', '')), '');
    v_margem := NULLIF(TRIM(COALESCE(it->>'margem', '')), '')::numeric;
    v_sit    := NULLIF(TRIM(COALESCE(it->>'situacao', '')), '');
    v_sal    := NULLIF(TRIM(COALESCE(it->>'salario', '')), '')::numeric;

    IF v_cpf = '' OR v_margem IS NULL THEN v_ign := v_ign + 1; CONTINUE; END IF;

    -- valida situação contra o enum (ignora valor inválido, mantém a atual)
    v_sit_e := NULL;
    IF v_sit IS NOT NULL AND v_sit IN ('ativo','aposentado','pensionista','inativo','exonerado','licenca') THEN
      v_sit_e := v_sit::situacao_matricula;
    END IF;

    SELECT id INTO v_cli FROM clientes WHERE cpf = v_cpf;
    IF v_cli IS NULL THEN v_miss := v_miss + 1; CONTINUE; END IF;

    UPDATE matriculas m
       SET margem_bruta         = v_margem,
           margem_atualizada_em = now(),
           situacao             = COALESCE(v_sit_e, m.situacao),
           salario_bruto        = COALESCE(v_sal, m.salario_bruto)
     WHERE m.cliente_id = v_cli
       AND m.convenio_id = p_convenio
       AND (v_mat IS NULL OR m.matricula = v_mat);

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows > 0 THEN v_upd := v_upd + v_rows; ELSE v_miss := v_miss + 1; END IF;
  END LOOP;

  RETURN QUERY SELECT v_upd, v_miss, v_ign;
END;
$$;
GRANT EXECUTE ON FUNCTION public.atualizar_margem_lote(uuid, jsonb) TO authenticated;

-- ------------------------------------------------------------
-- Recria capacidade_por_convenio incluindo o carimbo da base (mais recente
-- margem_atualizada_em entre os vínculos elegíveis). DROP necessário por
-- mudança na assinatura de retorno.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.capacidade_por_convenio();
CREATE FUNCTION public.capacidade_por_convenio()
RETURNS TABLE(
  convenio_id uuid,
  nome text,
  cidade text,
  uf text,
  prioridade_comercial prioridade_comercial,
  potencial_vendas int,
  ativo boolean,
  tomadores bigint,
  vinculos_elegiveis bigint,
  margem_disponivel numeric,
  margem_utilizada numeric,
  ticket_medio_margem numeric,
  base_atualizada_em timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT
    c.id,
    c.nome,
    COALESCE(e.cidade, c.orgao) AS cidade,
    e.uf,
    c.prioridade_comercial,
    c.potencial_vendas,
    c.ativo,
    count(DISTINCT m.cliente_id) FILTER (WHERE eleg.ok) AS tomadores,
    count(*) FILTER (WHERE eleg.ok) AS vinculos_elegiveis,
    COALESCE(sum(m.margem_disponivel) FILTER (WHERE eleg.ok), 0) AS margem_disponivel,
    COALESCE(sum(m.margem_utilizada) FILTER (WHERE eleg.ok), 0) AS margem_utilizada,
    CASE WHEN count(*) FILTER (WHERE eleg.ok) > 0
         THEN round(COALESCE(sum(m.margem_disponivel) FILTER (WHERE eleg.ok), 0)
                    / count(*) FILTER (WHERE eleg.ok), 2)
         ELSE 0 END AS ticket_medio_margem,
    max(m.margem_atualizada_em) AS base_atualizada_em
  FROM convenios c
  LEFT JOIN entidades_cadastro e ON e.id = c.entidade_id
  LEFT JOIN matriculas m ON m.convenio_id = c.id
  LEFT JOIN LATERAL (
    SELECT (m.id IS NOT NULL
            AND m.situacao IN ('ativo','aposentado','pensionista')
            AND c.ativo
            AND c.tipo_margem IN ('apartada','cartao')
            AND COALESCE(m.margem_disponivel, 0) > 0) AS ok
  ) eleg ON true
  GROUP BY c.id, c.nome, e.cidade, c.orgao, e.uf, c.prioridade_comercial, c.potencial_vendas, c.ativo;
$$;
GRANT EXECUTE ON FUNCTION public.capacidade_por_convenio() TO authenticated;
