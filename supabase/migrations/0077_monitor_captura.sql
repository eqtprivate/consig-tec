-- ============================================================
-- CONSIGTEC — BPO Fase 6: MONITOR de captura. Por competência, mostra por
-- convênio se o arquivo de RETORNO já foi capturado, o status da conciliação e
-- as ocorrências em aberto — destacando o que ainda FALTA capturar. Após 0076.
-- Idempotente.
-- ============================================================

CREATE OR REPLACE FUNCTION public.monitor_captura(p_competencia text, p_empresa uuid DEFAULT NULL)
RETURNS TABLE(
  convenio_id uuid, convenio text, averbadora text, dia_retorno int,
  capturado boolean, status text, total_itens int, ocorrencias_abertas int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE emp uuid;
BEGIN
  IF NOT auth_is_empresa_admin() THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
  emp := auth_empresa_efetiva(p_empresa);
  RETURN QUERY
  SELECT c.id, c.nome, av.nome, av.dia_retorno,
         rf.id IS NOT NULL AS capturado,
         rf.status,
         coalesce(rf.total_itens, 0),
         coalesce((SELECT count(*)::int FROM conciliacao_ocorrencias o
                    WHERE o.retorno_id = rf.id AND o.status = 'aberta'), 0)
  FROM convenios c
  LEFT JOIN averbadoras av ON av.id = c.averbadora_id
  LEFT JOIN LATERAL (
    SELECT r.* FROM retornos_folha r
    WHERE r.convenio_id = c.id AND r.competencia = p_competencia AND r.empresa_id = emp
    ORDER BY r.created_at DESC LIMIT 1
  ) rf ON true
  WHERE c.empresa_id = emp
  ORDER BY capturado ASC, c.nome;
END $$;
GRANT EXECUTE ON FUNCTION public.monitor_captura(text, uuid) TO authenticated;
