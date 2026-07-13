-- ============================================================
-- CONSIGTEC — Relatório de validação PÓS-SYNC PixConsig.
-- Rode no SQL Editor do Supabase DEPOIS do primeiro "Sincronizar agora"
-- (ou do cron). Retorna UMA tabela: seção · verificação · valor · situação.
-- Somente leitura — não altera nada. Situação '⚠ revisar' = olhar de perto.
-- ============================================================

SELECT secao, verificacao, valor, situacao FROM (

  -- 1. ESPELHO DE CONVÊNIOS ------------------------------------------------
  SELECT 10 ord, '1. Espelho' secao, 'Convênios (total)' verificacao, count(*)::text valor, '—' situacao FROM convenios
  UNION ALL SELECT 11, '1. Espelho', 'Convênios ativos', count(*) FILTER (WHERE ativo)::text, '—' FROM convenios
  UNION ALL SELECT 12, '1. Espelho', 'Origem PixConsig', count(*) FILTER (WHERE origem_dado = 'pixconsig')::text, '—' FROM convenios
  UNION ALL SELECT 13, '1. Espelho', 'Com pixconsig_convenio_id', count(*) FILTER (WHERE pixconsig_convenio_id IS NOT NULL)::text, '—' FROM convenios

  -- 2. ENTIDADES (cadastro) ------------------------------------------------
  UNION ALL SELECT 20, '2. Entidades', 'Entidades (total)', count(*)::text, '—' FROM entidades_cadastro
  UNION ALL SELECT 21, '2. Entidades', 'Com código IBGE', count(*) FILTER (WHERE codigo_ibge IS NOT NULL)::text, '—' FROM entidades_cadastro
  UNION ALL SELECT 22, '2. Entidades', 'Com CNPJ', count(*) FILTER (WHERE cnpj IS NOT NULL)::text, '—' FROM entidades_cadastro
  UNION ALL SELECT 23, '2. Entidades', 'Com contatos operacionais', count(*) FILTER (WHERE jsonb_array_length(coalesce(contatos, '[]'::jsonb)) > 0)::text, '—' FROM entidades_cadastro
  UNION ALL SELECT 24, '2. Entidades', 'Com população', count(*) FILTER (WHERE populacao IS NOT NULL)::text, '—' FROM entidades_cadastro

  -- 3. PRODUTOS ------------------------------------------------------------
  UNION ALL SELECT 30, '3. Produtos', 'Produtos parametrizados (total)', count(*)::text, '—' FROM produtos_convenio
  UNION ALL SELECT 31, '3. Produtos', 'Convênios com >= 1 produto', count(DISTINCT convenio_id)::text, '—' FROM produtos_convenio
  UNION ALL SELECT 32, '3. Produtos', 'Convênios SEM produto',
    (SELECT count(*) FROM convenios c WHERE NOT EXISTS (SELECT 1 FROM produtos_convenio p WHERE p.convenio_id = c.id))::text, '—'

  -- 4. MARGEM --------------------------------------------------------------
  UNION ALL SELECT 40, '4. Margem', 'Com margem apartada (%)', count(*) FILTER (WHERE percentual_margem_apartada IS NOT NULL)::text, '—' FROM convenios
  UNION ALL SELECT 41, '4. Margem', 'Com margem disponível', count(*) FILTER (WHERE margem_disponivel IS NOT NULL)::text, '—' FROM convenios

  -- 5. INTEGRIDADE (expectativas) -----------------------------------------
  UNION ALL SELECT 50, '5. Integridade', 'Convênios sem entidade vinculada (esperado 0)',
    count(*)::text, CASE WHEN count(*) = 0 THEN 'OK' ELSE '⚠ revisar' END
    FROM convenios WHERE origem_dado = 'pixconsig' AND entidade_id IS NULL
  UNION ALL SELECT 51, '5. Integridade', 'pixconsig_convenio_id duplicado (esperado 0)',
    (SELECT count(*) FROM (SELECT pixconsig_convenio_id FROM convenios WHERE pixconsig_convenio_id IS NOT NULL GROUP BY 1 HAVING count(*) > 1) d)::text,
    CASE WHEN (SELECT count(*) FROM (SELECT pixconsig_convenio_id FROM convenios WHERE pixconsig_convenio_id IS NOT NULL GROUP BY 1 HAVING count(*) > 1) d) = 0 THEN 'OK' ELSE '⚠ revisar' END
  UNION ALL SELECT 52, '5. Integridade', 'REPROVADA no espelho (esperado 0 — são ignoradas)',
    count(*)::text, CASE WHEN count(*) = 0 THEN 'OK' ELSE '⚠ revisar' END
    FROM convenios WHERE status_detalhado = 'REPROVADA'
  UNION ALL SELECT 53, '5. Integridade', 'Convênios PixConsig com nome vazio (esperado 0)',
    count(*)::text, CASE WHEN count(*) = 0 THEN 'OK' ELSE '⚠ revisar' END
    FROM convenios WHERE origem_dado = 'pixconsig' AND (nome IS NULL OR btrim(nome) = '')
  UNION ALL SELECT 54, '5. Integridade', 'Entidades duplicadas por nome+cidade+uf (esperado 0)',
    (SELECT count(*) FROM (SELECT nome, cidade, uf FROM entidades_cadastro GROUP BY 1,2,3 HAVING count(*) > 1) d)::text,
    CASE WHEN (SELECT count(*) FROM (SELECT nome, cidade, uf FROM entidades_cadastro GROUP BY 1,2,3 HAVING count(*) > 1) d) = 0 THEN 'OK' ELSE '⚠ revisar' END

  -- 6. OVERLAY CONSIGTEC PRESERVADO (não foi sobrescrito pelo sync) --------
  UNION ALL SELECT 60, '6. Overlay (CONSIGTEC)', 'Convênios PixConsig com taxa/spread definidos',
    (SELECT count(*) FROM convenios c WHERE c.origem_dado = 'pixconsig'
       AND (c.taxa_mensal IS NOT NULL OR EXISTS (SELECT 1 FROM overlay_comercial_convenio o WHERE o.convenio_id = c.id AND o.spread IS NOT NULL)))::text,
    '— (informativo)'

  -- 7. SINCRONIZAÇÃO -------------------------------------------------------
  UNION ALL SELECT 70, '7. Sync', 'Última sincronização (espelho)',
    coalesce(max(ultima_sincronizacao)::text, '(nunca)'), '—' FROM convenios
  UNION ALL SELECT 71, '7. Sync', 'Convênios com status_sync = erro (esperado 0)',
    count(*) FILTER (WHERE status_sync = 'erro')::text,
    CASE WHEN count(*) FILTER (WHERE status_sync = 'erro') = 0 THEN 'OK' ELSE '⚠ revisar' END FROM convenios
  UNION ALL SELECT 72, '7. Sync', 'Última execução (auditoria)',
    (SELECT coalesce(to_char(max(created_at), 'DD/MM/YYYY HH24:MI'), '(sem registro)') FROM auditoria WHERE acao IN ('sync_pixconsig','sync_pixconsig_manual')), '—'
  UNION ALL SELECT 73, '7. Sync', 'Resumo da última execução (ok/total/ign./erros)',
    (SELECT coalesce((valor_novo->>'ok') || '/' || (valor_novo->>'total') || ' · ' || coalesce(valor_novo->>'ignorados','0') || ' ign. · ' || coalesce(valor_novo->>'erros','0') || ' erro(s)', '(sem dados)')
       FROM auditoria WHERE acao IN ('sync_pixconsig','sync_pixconsig_manual') ORDER BY created_at DESC LIMIT 1), '—'

  -- 8. DISTRIBUIÇÕES (amostra) --------------------------------------------
  UNION ALL SELECT 80, '8. Distribuições', 'Status de credenciamento',
    (SELECT string_agg(s.k || ': ' || s.n, ' · ' ORDER BY s.n DESC)
       FROM (SELECT coalesce(status_detalhado,'(sem)') k, count(*) n FROM convenios GROUP BY 1) s), '—'
  UNION ALL SELECT 81, '8. Distribuições', 'CAPAG',
    (SELECT string_agg(s.k || ': ' || s.n, ' · ' ORDER BY s.n DESC)
       FROM (SELECT coalesce(capag,'(sem)') k, count(*) n FROM convenios GROUP BY 1) s), '—'
  UNION ALL SELECT 82, '8. Distribuições', 'Produtos por tipo',
    (SELECT string_agg(s.k || ': ' || s.n, ' · ' ORDER BY s.n DESC)
       FROM (SELECT produto k, count(*) n FROM produtos_convenio GROUP BY 1) s), '—'

) q ORDER BY ord;
