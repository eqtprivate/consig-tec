# CONSIGTEC — Validações pendentes

Registro de etapas implementadas que ainda precisam de **validação end-to-end**
no app + banco antes de considerar 100% homologadas.

Legenda: ⬜ pendente de validação · ✅ validado · ⚠️ validado com ressalva.

---

## ✅ Leitura Automática de CCB (migr. 0089–0093) — validado ao vivo (2026-07-16)

- **Chave Anthropic**: presente no runtime; leitura real de CCB de **15 páginas**
  escaneada — **45 campos** extraídos corretamente (Haiku ~10s, ~R$ 0,25).
- **Ajustes (0089)**: config de modelo/confiança por empresa, log de tentativas e
  reprocessamento — verificados via runtime (esquema + RPCs + reprocesso real).
- **Persistência (0090)**: colunas em `clientes`/`ccbs` + `dados_extraidos` jsonb e
  funções `num_br`/`parse_data_br`/`enriquecer_ccb_dados` — esquema conferido.
- **Arquivamento (0091)**: `config_ingestao_ccb.drive_folder_id/drive_ativo` +
  `salvar_arquivamento_ccb`; path do Storage por empresa/ano/mês.
- **Cota/gestão (0092/0093)**: colunas de limite no `planos`, `tamanho_bytes`,
  `uso_ingestao_empresa`, e funções de exclusão — esquema + autorização conferidos.

**Ressalvas / a fazer:** ⚠️ rodar `select backfill_tamanho_ccb();` (tamanho dos PDFs
antigos); ⬜ testar o **bloqueio de cota** pela UI (limite baixo → 2ª leitura recusada);
⬜ conferir a persistência dos campos ricos ao **aprovar** uma CCB real.

---

## ✅ Leitura de DECRETOS/LEIS (migr. 0094) — validado ao vivo (2026-07-16)

- **Schema (0094)**: confirmado aplicado no banco — `convenios` com **13/13** colunas novas
  (decreto_*, margem_*_pct, tipos/consignatárias jsonb, `decreto_dados`, `regras_origem`),
  `ingestoes_documento.convenio_id`, e RPC `aplicar_regras_decreto` existente/executável.
- **Edge Functions**: `ingerir_decreto` e `aprovar_decreto` publicadas (respondem 401).
- **Extração IA real**: Decreto **4.572/2019 (Manaus)** — todos os campos-alvo corretos
  (nº/data, ente/UF, lei base, **margem 40% / cartão 10%**, **prazo 96m**, adiantamento 20%,
  recomposição 48h, 1/3 erário, 12 tipos) por **~R$ 0,02** em ~3s (Haiku).
- **Comparação/validação**: conferência classifica cada regra como *preenche/confere/
  DIVERGENTE* contra o cadastro do convênio; divergência **exige justificativa** para aplicar.
- **Arquivo de Decretos**: banco + KPIs + detalhe (regras + jsonb + log + PDF).

**Ressalvas / a fazer:** ⬜ **Publish** no Base44 para expor as abas **Decretos (IA)** e
**Arquivo de Decretos**; ⬜ teste fim-a-fim pela UI aplicando um decreto real a um convênio
já preenchido (validar o caminho *DIVERGENTE* + justificativa).

---

## ⬜ Teste guiado fim-a-fim da esteira (migrs. 0024–0034)

**Status:** implementado, **validação pendente** (anotado a pedido do cliente em 2026-07-12).

Percorrer o fluxo inteiro num CPF semeado e confirmar que cada elo acende
automaticamente:

1. Consulta de Margem → gerar proposta → **reserva de margem** (margem cai).
2. Averbação `averbada` → **efetiva** a margem (aba Reconciliação).
3. Formalização concluída + antifraude aprovado.
4. CCB `assinada` (com **gating** da esteira) → **contrato + cronograma Price + comissões**.
5. Carteira: `atualizar_carteira` → atraso/inadimplência + **cobrança automática**.
6. Baixa de parcela → **quita contrato** e **resolve cobrança**.
7. Cessão → **montar lastro automático** (título da CCB + valor_total do termo).

**SELECTs de verificação:** ver o roteiro completo enviado no chat (passos 0–8).

**Como validar:** rodar o roteiro no ambiente publicado do Base44 + SQL Editor
(`blnslbrflspiflrwsuzh`). Marcar aqui ✅ quando confirmado; registrar qualquer
divergência como ⚠️ com a correção necessária.

### Migrações envolvidas (todas aplicadas pelo cliente)
- 0024 produtos_convenio + valor_maximo_por_margem
- 0025 capacidade_por_convenio
- 0026 base de margem (offline) + carimbo
- 0027 liberação de margem na recusa/cancelamento (trigger)
- 0028 reconciliação da margem na averbação (trigger)
- 0029 CCB assinada gera contrato (trigger)
- 0030 gating da esteira (proposta_pronta_para_contrato)
- 0031 baixa de parcelas + carteira
- 0032 comissões automáticas ao gerar contrato (trigger)
- 0033 cobrança automática de inadimplência
- 0034 montagem automática de lastro de cessão

---

## Outras pendências conhecidas
- **pg_cron** para `atualizar_carteira` (hoje manual) e para o disparo da fila
  de notificações (Resend) — deixado pendente a pedido do cliente.
