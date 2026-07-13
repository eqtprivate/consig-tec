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
-- ------------------------------------------------------------
-- PRESERVADO (não é tocado por este script):
--   Acesso ......... empresas, franquias, areas, papeis, usuarios, vinculos
--   Config/regras .. configuracoes, sla_etapas, regras_notificacao,
--                    regras_comissao, metas_comerciais, metas_operador,
--                    roteiro_scripts, motivos_perda, integracoes
--   Cessão (master). administradoras, cedentes, fundos, gestoras
-- APAGADO: tudo o mais (espelho de convênios + toda a esteira + CRM +
--   cessão operacional + colaboração/chamados + fila de notificações).
-- ============================================================

BEGIN;

SET session_replication_role = 'replica';  -- desliga triggers e checagem de FK

-- 1) Espelho de convênios (será repovoado pelo full sync da PixConsig)
DELETE FROM sincronizacoes_convenio;
DELETE FROM produtos_convenio;
DELETE FROM overlay_comercial_convenio;
DELETE FROM convenios;
DELETE FROM entidades_cadastro;

-- 2) Esteira de crédito (proposta → averbação → CCB → contrato → carteira)
DELETE FROM repasses_folha;
DELETE FROM parcelas;
DELETE FROM comissoes;
DELETE FROM cobrancas;
DELETE FROM refinanciamentos;
DELETE FROM contratos;
DELETE FROM ccbs;
DELETE FROM analises_antifraude;
DELETE FROM formalizacoes;
DELETE FROM averbacoes;
DELETE FROM propostas;
DELETE FROM reservas_margem;
DELETE FROM matriculas;

-- 3) Cessão (operacional — mantém as contrapartes master: fundos/gestoras/etc.)
DELETE FROM dados_deposito_cessao;
DELETE FROM assinaturas_cessao;
DELETE FROM itens_cessao;
DELETE FROM pdd_carteira;
DELETE FROM carteiras_adquiridas;
DELETE FROM termos_cessao;

-- 4) CRM / comercial
DELETE FROM interacoes;
DELETE FROM oportunidades;
DELETE FROM leads;
DELETE FROM campanhas;

-- 5) Clientes e consentimentos (LGPD ligado ao cliente)
DELETE FROM consentimentos;
DELETE FROM clientes;

-- 6) Colaboração auditável / chamados / mensageria
DELETE FROM validacoes_thread;
DELETE FROM thread_participantes;
DELETE FROM mensagens;
DELETE FROM threads;
DELETE FROM chamados_internos_mensagens;
DELETE FROM chamados_internos;
DELETE FROM chamados;

-- 7) Operacional
DELETE FROM pendencias;
DELETE FROM lgpd_solicitacoes;
DELETE FROM notificacoes;

-- 8) Trilha de auditoria / logs (histórico da fase de testes).
--    Comente as duas linhas abaixo se quiser PRESERVAR o histórico.
DELETE FROM logs_acesso;
DELETE FROM auditoria;

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
