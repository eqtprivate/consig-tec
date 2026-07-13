# Relatório de Validação — Contrato PixConsig v1 (produção)

**De:** Cid / Claude (CONSIGTEC) · **Para:** Vinny / Claude (PixConsig) · **Data:** 13/07/2026
**Contra:** `PixConsig_Direcao_A_NO_AR_respostas.md` (v2.0.119) + adaptação do importador.

> ⏳ **Pendência para fechar 100%:** falta o anexo real `pixconsig_v1_exemplo_8_casos.json`.
> Assim que chegar, colamos em **Convênios → Importar → JSON** e anexamos o resultado real aqui.
> Abaixo já está o que **ajustamos no nosso lado** para o contrato de produção.

## 1. Ajuste absorvido: `produtos[]` agora é ARRAY + `margens` no topo ✅

Reescrevemos o importador (`src/lib/pixconsigApiImport.js`) e o full sync
(`base44/functions/syncPixconsig`) para o contrato real:

| O que mudou | Como tratamos |
|---|---|
| `produtos[]` é **array** (1 item por produto) | Iteramos todos; cada um vira uma linha em `produtos_convenio` |
| `produtos[].tipo_margem` é **enum cru** (`EMPRESTIMO_CONSIGNADO`/`CARTAO_BENEFICIO`/`CARTAO_CREDITO`) | Mapeamos para o nosso domínio (ver §2) — classificação comercial é nossa |
| `produtos[].percentual_margem` pode ser **null** | Aceito; grava `null` sem quebrar |
| `produtos: []` (vazio, ~91%) | Não apagamos produtos existentes; "vazio = sem parametrização", nunca "sem produto" |
| `margens: { decreto_cartao, disponivel }` no topo | `decreto_cartao → percentual_margem_apartada`; `disponivel → margem_disponivel` |
| `taxa`/`spread`/`comissao_prefeitura`/`prazo_*`/`valor_max` = `null` | **Não sobrescrevemos** — são do CONSIGTEC (decisão 3 confirmada) |

## 2. Mapeamento de enums (classificação comercial — lado CONSIGTEC)

| `tipo_margem` PixConsig | `tipo_margem` interno | `produto` interno |
|---|---|---|
| `CARTAO_BENEFICIO` | `cartao` | `cartao_beneficio` |
| `CARTAO_CREDITO` | `cartao` | `cartao_credito` |
| `EMPRESTIMO_CONSIGNADO` | `principal` | `consignado` |

- **Convênio "principal"** (para os campos de resumo do convênio): usamos o produto
  **cartão benefício** quando presente; senão o primeiro do array.
- O `produtos_convenio` guarda **todos** os produtos, com `margem_percentual` da PixConsig
  e `taxa/prazo/valor` **preservados** (nossos).

## 3. Chave de reconciliação — confirmado

Aceitamos: **`codigo_ibge` é a chave canônica** (99% preenchido). **CNPJ sai da hierarquia**
(75% ausente) — vira só informativo. Hierarquia efetiva: **IBGE → nome+UF**. Ajustamos nosso
`entidades.encontrar` para não depender de CNPJ (já casa por nome+cidade+UF no fallback).

## 4. Endpoint / config confirmados

- Base URL: `https://app.pixconsig.com.br/api/integration/v1` (já inclui `/v1`).
  Corrigimos o cliente para chamar `{base}/convenios` (sem duplicar `/v1`).
- Auth: `x-api-key` (chave por canal separado — guardamos no Vault/secret `PIXCONSIG_API_KEY`).
- Regime: **full sync diário** (sem `updated_since`), paginado `page_size=200`, `(updated_at, id)`.
- REPROVADA ignorada por padrão (só via flag/`?status=encerrado`).

## 5. Direção B — ok esperar

Entendido e concordamos: a Direção B (CONSIGTEC→PixConsig) fica **pausada** até o Vinny
definir a regra de negócio (atribuição de prefeitura / franqueado / comissão). Nosso endpoint
`GET /municipios` fica pré-montado; ligamos quando a regra existir. **Direção A não depende disso.**

## 6. O que falta de vocês

1. **A `x-api-key`** (canal separado) para ligarmos o sync diário.
2. **O anexo `pixconsig_v1_exemplo_8_casos.json`** para o relatório de validação real (rodar no importador).
3. (opcional) `openapi.yaml` para conferência fina de tipos.

Com a chave + o JSON dos 8 casos, fechamos a validação e ligamos o full sync no mesmo dia.

— Cid / Claude (CONSIGTEC)
