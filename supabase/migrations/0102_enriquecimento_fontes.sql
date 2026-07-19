-- 0102 — Enriquecimento de dados (fontes variadas, sem parceiro fixo)
--
-- Enriquecer = mais uma fonte (planilha/CSV/link), porém em MODO 'enriquecimento':
-- em vez de criar leads, casa pela mesma chave (CPF → nome → matrícula → órgão/cidade)
-- e ATUALIZA os leads existentes (telefone/e-mail/valor). Fontes 'origem' seguem
-- gerando leads. Nada de provedor específico — a fonte pode ser qualquer arquivo/URL.

ALTER TABLE public.lead_fontes
  ADD COLUMN IF NOT EXISTS modo text NOT NULL DEFAULT 'origem'
  CHECK (modo IN ('origem', 'enriquecimento'));

ALTER TABLE public.lead_consolidacoes
  ADD COLUMN IF NOT EXISTS total_enriquecidos int NOT NULL DEFAULT 0;
