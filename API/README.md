# API — Integração CONSIGTEC ↔ PixConsig

Documentação da integração de **convênios/municípios** entre a **PixConsig**
(cadastro + margem) e o **CONSIGTEC** (parametrização comercial e operação).

## Índice

| Arquivo | O que é | Autor |
|---|---|---|
| `CONSIGTEC_API_PixConsig_Contrato.md` | Contrato/entidades que o CONSIGTEC pediu para consumir | CONSIGTEC |
| `CONSIGTEC_Prompt_API_PixConsig_ClaudeCode.md` | Prompt de especificação enviado à PixConsig | CONSIGTEC |
| `PixConsig_Proposta_v1_recebida.md` | **Proposta v1 recebida da PixConsig** (mapeamento campo a campo + lacunas) | PixConsig |
| `CONSIGTEC_Resposta_API_PixConsig_v1.md` | Resposta técnica (versão anterior) | CONSIGTEC |
| `CONSIGTEC_Resposta_PixConsig_v1.md` | **Resposta oficial** — 6 decisões + full sync diário + sync bidirecional (Direção B) | CONSIGTEC |
| `pixconsig_v1_exemplo_referencia.json` | **JSON de referência** do payload v1 (casos de borda) para validar o contrato | CONSIGTEC |

## Estado da integração

- **Direção A — PixConsig → CONSIGTEC** (full sync **diário**): consumidor pronto
  (`base44/functions/syncPixconsig` + importador manual em Convênios → Importar → JSON).
  Falta: base URL + `x-api-key` da PixConsig.
- **Direção B — CONSIGTEC → PixConsig**: endpoint `GET /api/functions/municipios`
  pré-montado (read-only, `x-api-key` própria, reconciliação por `codigo_ibge`).
  Falta: habilitar `MUNICIPIOS_API_KEY` e alinhar cadência.

## Próximo passo

Receber da PixConsig um **JSON detalhado de exemplo** (10–20 municípios) cobrindo
os casos de borda listados em `CONSIGTEC_Resposta_PixConsig_v1.md` (seção 6).
Ao receber, colar em **Convênios → Importar → JSON (API PixConsig v1)** e gerar
o relatório de validação do contrato.

## Código relacionado (fora desta pasta)

- `base44/functions/syncPixconsig/entry.ts` — full sync (Direção A)
- `base44/functions/municipios/entry.ts` — feed de municípios (Direção B)
- `src/lib/pixconsigApiImport.js` — importador do payload JSON v1
- `src/lib/pixconsigImport.js` — importador CSV (espelho)
- `supabase/migrations/0005_estagio1_pixconsig.sql` — espelho local (entidades/convênios)
- `supabase/migrations/0045_cron_sync_pixconsig.sql` — cron diário do full sync
