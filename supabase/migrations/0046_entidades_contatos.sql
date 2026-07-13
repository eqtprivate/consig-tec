-- ============================================================
-- CONSIGTEC — Contatos operacionais do município (PixConsig, decisão 2).
-- Guarda contatos_operacionais (nome/email/telefone/papel) da entidade.
-- PII institucional — leitura restrita a admin já pela RLS de entidades.
-- Após 0045. Idempotente.
-- ============================================================

ALTER TABLE entidades_cadastro ADD COLUMN IF NOT EXISTS contatos jsonb DEFAULT '[]'::jsonb;
