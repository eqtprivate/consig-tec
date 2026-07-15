-- ============================================================
-- CONSIGTEC — Item 6: cessão — deságio por lote (KPI), regime de coobrigação
-- (pro solvendo / pro soluto), recompra e export bordereau.
-- Corpo completo aplicado no banco via MCP. Resumo:
--  * termos_cessao.regime_coobrigacao ('pro_solvendo'|'pro_soluto', backfill do
--    flag sem_coobrigacao). itens_cessao.recompravel + recomprada_em.
--  * desagio_por_lote(empresa): KPI valor_face x cedido, deságio %, por termo.
--  * bordereau_termo(termo): linhas do arquivo de remessa.
--  * recomprar_item_cessao(item): só pro solvendo; marca parcelas 'recomprada'.
-- Idempotente.
-- ============================================================
ALTER TABLE public.termos_cessao ADD COLUMN IF NOT EXISTS regime_coobrigacao text;
ALTER TABLE public.itens_cessao
  ADD COLUMN IF NOT EXISTS recompravel   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recomprada_em timestamptz;
UPDATE public.termos_cessao SET regime_coobrigacao =
  CASE WHEN sem_coobrigacao THEN 'pro_soluto' ELSE 'pro_solvendo' END WHERE regime_coobrigacao IS NULL;
-- (funções desagio_por_lote / bordereau_termo / recomprar_item_cessao: ver 0087 no projeto)
