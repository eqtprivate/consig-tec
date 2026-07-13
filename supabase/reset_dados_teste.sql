-- ============================================================
-- CONSIGTEC — RESET DE DADOS DE TESTE (antes de rodar a integração PixConsig)
-- ============================================================
-- Limpa TODO o dado transacional e o espelho de convênios, PRESERVANDO a
-- fundação de acesso e a configuração/paramentrização do sistema.
--
-- ⚠️  IRREVERSÍVEL. Rode uma vez, no SQL Editor do Supabase, com o banco em
--     janela de manutenção. Faça um backup/snapshot antes se houver qualquer
--     dúvida.
--
-- Estratégia: session_replication_role = 'replica' desliga, dentro da
-- transação, os triggers da esteira (reserva/baixa/comissão/cessão) E os
-- gatilhos de FK. Assim os DELETEs são rápidos e NÃO há CASCADE surpresa
-- para dentro das tabelas de configuração (ex.: regras_comissao e
-- metas_comerciais têm convenio_id ON DELETE CASCADE — que NÃO queremos
-- disparar). Apagamos exatamente a lista abaixo, nada além dela.
--
-- Cada tabela é apagada só SE existir (to_regclass), então o script é
-- tolerante a migrações que não tenham sido aplicadas neste banco.
--
-- ------------------------------------------------------------
-- PRESERVADO (não é tocado por este script):
--   Acesso ......... empresas, franquias, areas, papeis, usuarios, vinculos
--   Config/regras .. configuracoes, sla_etapas, regras_notificacao,
--                    regras_comissao, metas_comerciais, metas_operador,
--                    roteiro_scripts, motivos_perda, integracoes
--   Cessão (master). administradoras, cedentes, fundos, gestoras
-- APAGADO: tudo o mais (espelho de convênios + toda a esteira + CRM +
--   cessão operacional + colaboração/chamados + fila de notificações).
--
-- Auditoria/logs: apagados por padrão (bloco final da lista). Para PRESERVAR
--   o histórico, remova 'logs_acesso' e 'auditoria' do array abaixo.
-- ============================================================

BEGIN;

SET session_replication_role = 'replica';  -- desliga triggers e checagem de FK

DO $$
DECLARE
  alvo text;
  apagadas text[] := ARRAY[
    -- 1) Espelho de convênios (repovoado pelo full sync da PixConsig)
    'sincronizacoes_convenio','produtos_convenio','overlay_comercial_convenio',
    'convenios','entidades_cadastro',
    -- 2) Esteira de crédito
    'repasses_folha','parcelas','comissoes','cobrancas','refinanciamentos',
    'contratos','ccbs','analises_antifraude','formalizacoes','averbacoes',
    'propostas','reservas_margem','matriculas',
    -- 3) Cessão operacional (mantém contrapartes master)
    'dados_deposito_cessao','assinaturas_cessao','itens_cessao','pdd_carteira',
    'carteiras_adquiridas','termos_cessao',
    -- 4) CRM / comercial
    'interacoes','oportunidades','leads','campanhas',
    -- 5) Clientes e consentimentos
    'consentimentos','clientes',
    -- 6) Colaboração auditável / chamados / mensageria
    'validacoes_thread','thread_participantes','mensagens','threads',
    'chamados_internos_mensagens','chamados_internos','chamados',
    -- 7) Operacional
    'pendencias','lgpd_solicitacoes','notificacoes',
    -- 8) Auditoria / logs (remova estas duas p/ preservar o histórico)
    'logs_acesso','auditoria'
  ];
  n bigint;
BEGIN
  FOREACH alvo IN ARRAY apagadas LOOP
    IF to_regclass('public.' || alvo) IS NOT NULL THEN
      EXECUTE format('DELETE FROM public.%I', alvo);
      GET DIAGNOSTICS n = ROW_COUNT;
      RAISE NOTICE 'apagada %: % linhas', alvo, n;
    ELSE
      RAISE NOTICE 'ignorada % (não existe)', alvo;
    END IF;
  END LOOP;
END $$;

SET session_replication_role = 'origin';  -- religa triggers e FKs

-- Registra o reset na auditoria (após religar os triggers)
INSERT INTO auditoria (entidade, registro_id, acao, valor_novo)
VALUES ('sistema', NULL, 'reset_dados_teste',
        jsonb_build_object('motivo', 'pré-integração PixConsig', 'data', now()));

COMMIT;

-- ------------------------------------------------------------
-- Conferência pós-reset (deve retornar 0 em tudo, exceto a config preservada)
-- ------------------------------------------------------------
SELECT 'convenios' t, count(*) n FROM convenios
UNION ALL SELECT 'entidades_cadastro', count(*) FROM entidades_cadastro
UNION ALL SELECT 'produtos_convenio', count(*) FROM produtos_convenio
UNION ALL SELECT 'clientes', count(*) FROM clientes
UNION ALL SELECT 'propostas', count(*) FROM propostas
UNION ALL SELECT 'contratos', count(*) FROM contratos
UNION ALL SELECT 'threads', count(*) FROM threads
UNION ALL SELECT 'notificacoes', count(*) FROM notificacoes
UNION ALL SELECT '— PRESERVADO: usuarios', count(*) FROM usuarios
UNION ALL SELECT '— PRESERVADO: papeis', count(*) FROM papeis
UNION ALL SELECT '— PRESERVADO: regras_comissao', count(*) FROM regras_comissao
UNION ALL SELECT '— PRESERVADO: configuracoes', count(*) FROM configuracoes
ORDER BY t;
