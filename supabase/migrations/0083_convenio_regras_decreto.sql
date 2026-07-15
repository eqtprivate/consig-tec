-- ============================================================
-- CONSIGTEC — Item 2: "Decreto como dado". Estrutura as regras operacionais do
-- convênio (do decreto/norma) que o motor de elegibilidade/travas (Item 5) lê.
-- Onde a PixConsig ainda não entrega, o admin preenche manualmente (regras_manuais).
-- Aditivo/idempotente. prazo_maximo e margem já existiam; aqui só o que faltava.
-- ============================================================
ALTER TABLE public.convenios
  ADD COLUMN IF NOT EXISTS idade_minima            int,
  ADD COLUMN IF NOT EXISTS idade_maxima_fim        int,
  ADD COLUMN IF NOT EXISTS teto_parcelas           int,
  ADD COLUMN IF NOT EXISTS max_contratos_servidor  int,
  ADD COLUMN IF NOT EXISTS prioridade_desconto     int,
  ADD COLUMN IF NOT EXISTS margem_por_produto      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS regras_manuais          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS regras_atualizadas_em   timestamptz;

COMMENT ON COLUMN public.convenios.idade_maxima_fim IS 'Idade máxima do tomador ao término do contrato (decreto).';
COMMENT ON COLUMN public.convenios.margem_por_produto IS 'Percentual de margem por produto: {"apartada":30,"cartao":5,"rmc":5}.';
