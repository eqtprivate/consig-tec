-- ============================================================
-- CONSIGTEC — Item 5: motor de travas + relógio dos 30 dias.
-- Corpo completo aplicado no banco via MCP. Resumo:
--  * consentimentos ganha proposta_id + forma (consentimento por operação).
--  * avaliar_travas_operacao(proposta): checklist (averbação, prazo/teto, idade,
--    margem x parcela, PMT calc x informado) → { bloqueia, travas[] }.
--  * trg_ccb_exige_averbacao: CCB nativa (provider<>'ingestao') exige averbação
--    'averbada'; exceção só com GUC app.trava_justificativa (logada em auditoria).
--  * relogio_margem(alerta, prazo): averbações a expirar (30d) sem CCB emitida.
-- Idempotente.
-- ============================================================
ALTER TABLE public.consentimentos
  ADD COLUMN IF NOT EXISTS proposta_id uuid REFERENCES propostas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS forma       text;
-- (funções e trigger: ver 0086 no histórico do projeto Supabase)
