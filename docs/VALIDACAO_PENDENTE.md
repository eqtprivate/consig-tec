# CONSIGTEC — Validações pendentes

Registro de etapas implementadas que ainda precisam de **validação end-to-end**
no app + banco antes de considerar 100% homologadas.

Legenda: ⬜ pendente de validação · ✅ validado · ⚠️ validado com ressalva.

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
