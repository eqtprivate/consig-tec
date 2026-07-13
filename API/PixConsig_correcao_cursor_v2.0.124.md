# PixConsig → CONSIGTEC — Correção crítica na API + instruções de sync

**De:** Vinny / Claude (PixConsig) · **Para:** Cid / Claude (CONSIGTEC)
**Data:** 13/07/2026 · **Versão PixConsig em produção:** 2.0.124

Cid, achamos a causa do espelho travar em 446 de 1100. **O bug era da API da PixConsig, não do seu importador.** Já está corrigido em produção. Você precisa de UM ajuste no seu sync.

---

## Credenciais

- **Base URL:** `https://app.pixconsig.com.br/api/integration/v1`
- **Auth:** header `x-api-key` (chave enviada por WhatsApp, fora deste documento)

Endpoints (todos GET — namespace somente leitura, não existe rota de escrita):

| Endpoint | Descrição |
|---|---|
| `GET /convenios` | Lista (keyset ou offset) |
| `GET /convenios/{id}` | Detalhe |
| `GET /health` | Disponibilidade (sem auth) |

---

## 1. A causa raiz dos 446

**568 dos 1100 convênios têm o `updated_at` EXATAMENTE IDÊNTICO:** `2026-06-30T00:19:00.965Z` — resultado de um reset em massa de prazo feito em 29/06/2026. A base inteira tem apenas **307 timestamps distintos para 1100 registros**.

Seu sync (corretamente) guardava o último `updated_at` visto e reenviava em `updated_since`. Só que nossa API filtrava com `>` (maior que). O resultado:

1. Você pede a 1ª leva → recebe 200 registros, todos com `updated_at = 2026-06-30T00:19:00.965Z`
2. Guarda o cursor = `2026-06-30T00:19:00.965Z`
3. Pede `?updated_since=2026-06-30T00:19:00.965Z`
4. **Os 368 registros restantes com esse MESMO timestamp somem para sempre**

Isso explica o viés exato do seu diagnóstico: você capturou 63% dos AGUARDANDO_ANALISE (timestamps antigos, vieram primeiro) mas só **3% das ATIVAs** e **7% dos AGUARDANDO_DECRETO** — esses foram mexidos recentemente, têm `updated_at` novo, e ficavam depois do buraco.

---

## 2. A correção (já no ar)

Implementamos **paginação keyset com cursor composto `(updated_at, id)`**:

```sql
WHERE (updated_at > :ts) OR (updated_at = :ts AND id > :id)
```

Imune a timestamps repetidos. A resposta agora traz `pagination.next_cursor` (string opaca — você só ecoa de volta, não precisa interpretar).

**Validado em produção: percorre os 1100 com ZERO perdas e ZERO duplicatas.**

---

## 3. O que você precisa mudar

### Full sync (recomendado, diário)

```
GET /convenios?page_size=200
  → { "data": [...],
      "pagination": { "mode": "keyset", "next_cursor": "MjAyNi0w...", "has_next": true } }

GET /convenios?page_size=200&cursor=MjAyNi0w...
  → repetir enquanto has_next == true
```

Termina quando `has_next: false` / `next_cursor: null`.

### Delta (incremental)

```
GET /convenios?updated_since=<ISO-8601>&page_size=200   ← SÓ a 1ª chamada
GET /convenios?cursor=<next_cursor>&page_size=200       ← TODAS as demais
```

### ⚠️ REGRA DE OURO

**Nunca remonte o `updated_since` a partir dos dados recebidos.** Depois da primeira chamada, use SEMPRE o `next_cursor` que devolvemos. (O `updated_since` agora usa `>=` em vez de `>`, mas ele sozinho não basta.)

O modo antigo `?page=&page_size=` continua funcionando para full sync pontual, mas **não o use com `updated_since` para delta**. `page_size` máximo = 200 (valores maiores são reduzidos silenciosamente).

---

## 4. Recuperação recomendada

Rode um **full sync completo via cursor** (sem `updated_since`) para reconstruir o espelho do zero. Seu upsert é idempotente, então é seguro.

Deve fechar em **1100 convênios**, com esta distribuição exata:

| Status | Esperado |
|---|---|
| AGUARDANDO_ANALISE | 434 |
| PROCESSO_EM_ANDAMENTO | 393 |
| AGUARDANDO_DECRETO | 239 |
| ATIVA | 34 |
| **Total** | **1100** |

REPROVADAs (220) são filtradas por padrão. Só vêm com `?status=encerrado`.

---

## 5. Formato de `produtos[]` — confira seu importador

O campo interno `tipoMargem` da PixConsig **não é um enum**: é um array JSON, e cada entrada é **um produto**. Nossa API faz o parse e entrega `produtos[]` como array de verdade:

```json
"margens": { "decreto_cartao": null, "disponivel": null },
"produtos": [
  { "produto_id": "emprestimo-consignado", "nome": "Emprestimo Consignado",
    "tipo_margem": "EMPRESTIMO_CONSIGNADO", "percentual_margem": 40,
    "prazo_min": null, "prazo_max": null, "valor_max": null,
    "taxa": null, "spread": null, "comissao_prefeitura": null },
  { "produto_id": "cartao-beneficio", "nome": "Cartao Beneficio",
    "tipo_margem": "CARTAO_BENEFICIO", "percentual_margem": 5,
    "prazo_min": null, "prazo_max": null, "valor_max": null,
    "taxa": null, "spread": null, "comissao_prefeitura": null }
]
```

Três pontos de atenção:

1. **Enum `tipo_margem`** (domínio PixConsig): `EMPRESTIMO_CONSIGNADO`, `CARTAO_BENEFICIO`, `CARTAO_CREDITO`. **Não mapeamos** para `apartada|principal|cartao` — essa classificação é decisão comercial, e comercial é de vocês.
2. **`percentual_margem` pode ser `null`** mesmo com o produto presente (margem cadastrada vazia no banco).
3. **`produtos: []` (vazio) é o caso comum** (~91% dos convênios). Significa "sem parametrização na PixConsig", **nunca** "sem produto".

Campos que saem **sempre `null` declarado** (nascem no CONSIGTEC, conforme acordado): `taxa`, `spread`, `comissao_prefeitura`, `prazo_min`, `prazo_max`, `valor_max`. Também `null`: número/data do decreto, `capag.data_consulta`, `capag.fonte`, `averbacao.data_corte`, `vigencia_fim`.

**Trate `null` como "não gerido pela PixConsig", nunca como zero.**

---

## 6. Chaves de reconciliação — CNPJ NÃO SERVE

Números medidos na base real:

| Campo | Cobertura |
|---|---|
| **`codigo_ibge`** | **1091 de 1100 (99%)** ✅ |
| **`cnpj`** | **273 de 1100 (25%)** ❌ |
| `capag` | 963 de 1100 |

**Use `codigo_ibge` como chave canônica.** Sua hierarquia planejada (IBGE → CNPJ → nome+UF) na prática vira **IBGE → nome+UF** — 75% da base não tem CNPJ.

Dois avisos sobre a qualidade dos dados:

- **44 cidades duplicadas** na PixConsig (93 convênios envolvidos) — mesma cidade+UF em mais de um registro. Seu dedup de entidade por nome+cidade+uf está correto.
- Há registros que **não são prefeituras**: "Distrito Federal/DF", "Amazonas/AM", "Pará/PA", "Maranhão/MA", "CanoasPrev/RS". Dado sujo do nosso lado; vamos limpar.

---

## 7. Mapeamento de status

| Interno (`status_detalhado`) | API (`credenciamento.status`) |
|---|---|
| AGUARDANDO_ANALISE / AGUARDANDO_DECRETO / PROCESSO_EM_ANDAMENTO | `em_credenciamento` |
| ATIVA | `ativo` |
| INATIVA | `suspenso` |
| REPROVADA | `encerrado` |

**Nota:** INATIVA = **0 registros** — o status existe no enum mas nunca é usado na prática.

Além do status mapeado, mandamos `status_detalhado` (enum interno cru) e `decreto_enviado` (boolean: o franqueado sinalizou envio do decreto e aguarda aprovação do admin).

---

## 8. Bônus: os dados melhoraram

Corrigimos em paralelo dois bugs que afetam o que você consome:

- POST/PUT de prefeitura estavam **descartando o `ibgeCode`** → registros sem IBGE caíram de 11 para 9
- A importação de **CAPAG** gravava o código IBGE no lugar do nome da cidade → classificações podem ter mudado

Mais um motivo para rodar o full sync completo.

---

## 9. Encoding

A API serve **UTF-8 puro**. Se seu cliente for .NET/PowerShell, force UTF-8 na leitura da resposta — o `Invoke-RestMethod` do PowerShell 5.1 assume ISO-8859-1 e corrompe acentos ("Irará" vira "IrarÃ¡"). Não é problema da API.

---

## 10. Se ainda der erro

Manda o **código HTTP e a mensagem exata**. Temos acesso à trilha de auditoria da PixConsig — conseguimos ver suas chamadas chegando (endpoint, filtros, quantidade retornada, timestamp) e diagnosticar do nosso lado.
