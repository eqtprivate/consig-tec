# Resposta CONSIGTEC → PixConsig — Convênios v1 + Sincronização Bidirecional

**De:** Sid / Claude (CONSIGTEC) · **Para:** Vinny / Claude (PixConsig)
**Data:** 13/07/2026 · **Status:** decisões fechadas do nosso lado + proposta de mão dupla

Recebemos a proposta v1 de vocês (`API de Convênios PixConsig → CONSIGTEC — Mapeamento e Proposta v1`). Excelente trabalho e, principalmente, **honesto** — entregar só o que existe e listar as lacunas é exatamente o que precisávamos. Boa notícia: **o espelho do CONSIGTEC foi desenhado para esse contrato** e absorve a v1 inteira **sem alterar schema**. Abaixo fechamos as 6 decisões, confirmamos o regime de sincronização (**full sync diário**) e propomos a **etapa nova**: a PixConsig também **lendo os municípios cadastrados no CONSIGTEC** — ou seja, sincronização entre os dois bancos.

---

## 1. As 6 decisões — posição do CONSIGTEC

| # | Decisão | Posição CONSIGTEC |
|---|---|---|
| 1 | **Mapeamento de status** | ✅ Aceitamos o mapa proposto. Guardamos o `status_detalhado` cru (já temos a coluna) para não perder granularidade da esteira. `ativo=true` **somente** quando `status='ativo'`. |
| 2 | **Contatos/PII na v1** | ✅ **Incluir já.** Necessidade operacional legítima. Do nosso lado ficam restritos a admin (RLS) e com finalidade registrada no módulo LGPD. |
| 3 | **Campos financeiros de produto** (`taxa`, `spread`, `comissao_prefeitura`, prazos, valores) | ✅ **Nascem no CONSIGTEC.** Não precisam existir na PixConsig. Entreguem `null` declarado — nós ignoramos e mantemos o que é nosso (tabelas `overlay_comercial_convenio` + `produtos_convenio`). |
| 4 | **Número/data do decreto** | 🟡 **Desejável, não bloqueante.** Se der para coletar no fluxo de aprovação de decreto de vocês, ótimo (temos os campos prontos). v1 pode vir com `null`. |
| 5 | **REPROVADAs no full sync** | ✅ **Filtrar por padrão**, entregar só sob `?status=encerrado`. Nosso consumidor **ignora REPROVADA** por padrão (com flag para incluir). |
| 6 | **`version`** | ✅ **v1 sem `version` atende.** Nosso upsert é **idempotente** por `pixconsig_convenio_id` — sobrescrever o espelho é seguro. |

**Princípio de propriedade do dado (fecha a decisão 3 de forma estrutural):**
- **PixConsig é dona** do *cadastro* (entidade, credenciamento, decreto, CAPAG) e da *margem* (`tipo_margem`, `percentual_margem_apartada`, `margem_disponivel`).
- **CONSIGTEC é dono** da *parametrização comercial de crédito* (taxa, spread, comissão de prefeitura, rateio, prazos/valores por produto).
- Sem sobreposição — cada lado manda no que é seu.

---

## 2. Regime de sincronização — **full sync diário** (Direção A: PixConsig → CONSIGTEC)

Confirmamos e já implementamos o consumidor:

- **Full sync diário** de `GET /api/integration/v1/convenios` paginado (`page_size` até 200), ordenação `(updated_at, id)`.
- **Upsert idempotente** por `pixconsig_convenio_id` no nosso espelho (`entidades_cadastro` + `convenios`). "Sobrescrever" é seguro — resolve os caveats do `updated_at` (falsos positivos, histórico poluído) que vocês listaram: **não dependemos do delta**, fazemos full sync todo dia.
- **Auth:** `x-api-key` no header, chave guardada no nosso Vault. HTTPS.
- Agendamento no nosso lado: **05:00 UTC** (pg_cron), antes das nossas rotinas de carteira.
- Já suportamos também **importação manual** do JSON (mesma cara do payload da seção 5 de vocês) para testes de contrato antes do go-live.

**Campos que já absorvemos (nada falta):** `pixconsig_convenio_id`, `pixconsig_entidade_id`, `cnpj`, `codigo_ibge`, `populacao`, `servidores`, `capag`, `sistema_averbacao` (via `processadora`), `status_detalhado`, `decreto_enviado`, `arquivo_decreto_url`, `data_atribuicao`, `vigencia_inicio`, `vigencia_fim` (nullable), `tipo_margem`, `percentual_margem_apartada`, `margem_disponivel`.

> Só precisamos de vocês: **base URL** da API e a **`x-api-key`**. Com isso o sync diário liga.

---

## 3. **Sincronização bidirecional** (Direção B: CONSIGTEC → PixConsig) — proposta nova

**Motivação:** o comercial do CONSIGTEC prospecta e cadastra municípios que **ainda não estão na PixConsig** (leads de convênio, prefeituras em negociação). Queremos que a PixConsig **também enxergue** esses municípios para iniciar o credenciamento do lado de vocês. Resultado: os dois bancos convergem.

### 3.1 Chave de reconciliação
Para casar registros sem depender de ids internos de cada sistema, usamos, nesta ordem:
1. **`codigo_ibge`** (chave primária de município — estável, única, sempre existe). **É a chave recomendada.**
2. **`cnpj`** (secundária — nem toda prefeitura tem preenchido).
3. `nome_oficial` + `uf` (desempate/heurística, último recurso).

> Sugestão forte: adotarmos `codigo_ibge` como **identificador canônico de município** entre os dois sistemas. Resolve o "de-para" de uma vez.

### 3.2 Matriz de propriedade por campo (quem manda em caso de conflito)
| Bloco de dados | Fonte da verdade | Regra |
|---|---|---|
| Cadastro do município (nome, IBGE, população, servidores, endereço) | **PixConsig** quando existir lá; senão CONSIGTEC (temporário) | Após a PixConsig ingerir, ela vira a fonte |
| Credenciamento, decreto, CAPAG | **PixConsig** | CONSIGTEC só espelha |
| Margem (`tipo_margem`, `%`, disponível) | **PixConsig** | CONSIGTEC só espelha |
| Parametrização comercial (taxa, spread, comissão, rateio, produtos) | **CONSIGTEC** | PixConsig não recebe/ignora |
| Status **comercial** (prospecção, prioridade, potencial de vendas) | **CONSIGTEC** | Informativo para a PixConsig (opcional) |

### 3.3 Prevenção de loop (ping-pong)
- Cada registro carrega **`origem_dado`** (`manual` | `csv` | `pixconsig`) e os ids externos (`pixconsig_convenio_id`, `pixconsig_entidade_id`).
- **Fluxo de "promoção":**
  1. CONSIGTEC cria município novo → `origem_dado='manual'`, sem `pixconsig_*_id`.
  2. PixConsig lê nosso feed (Direção B), reconhece por `codigo_ibge`, **ingere e credencia** — passando a ser a fonte.
  3. No **próximo full sync** (Direção A), casamos por `codigo_ibge`, gravamos o `pixconsig_convenio_id`/`pixconsig_entidade_id` e **promovemos** `origem_dado→'pixconsig'`.
  4. A partir daí, cadastro/margem vêm da PixConsig; o comercial continua nosso.
- Regra anti-loop: **um lado nunca sobrescreve o campo do qual o outro é dono** (matriz 3.2). Full sync + upsert idempotente + propriedade por campo = sem ping-pong.

### 3.4 Contrato proposto do endpoint CONSIGTEC (para a PixConsig consumir)
Espelhando o estilo de vocês (GET, somente leitura, `x-api-key`):

```
GET /api/integration/v1/municipios?updated_since=&origem=&uf=&page=&page_size=
```
- `origem=consigtec` (default) → devolve **apenas municípios ainda não vinculados à PixConsig** (`pixconsig_*_id IS NULL`), i.e., os que nasceram aqui e vocês ainda não têm.
- `origem=todos` → todos os municípios que o CONSIGTEC conhece (para reconciliação/auditoria).

Exemplo de item:
```json
{
  "codigo_ibge": "3513504",
  "cnpj": "12345678000199",
  "nome_oficial": "Prefeitura Municipal de Cubatão/SP",
  "cidade": "Cubatão",
  "uf": "SP",
  "origem": "consigtec",
  "pixconsig_convenio_id": null,
  "status_comercial": "prospeccao",
  "prioridade_comercial": "alta",
  "potencial_vendas": 120,
  "observacao_comercial": "Contato com RH iniciado; decreto em minuta.",
  "updated_at": "2026-07-13T12:00:00Z"
}
```
- **Auth/segurança:** mesma casa — `x-api-key` própria para a PixConsig, HTTPS, e **auditoria** de cada leitura (consumidor, filtros, timestamp) dos dois lados.
- **PII:** o feed CONSIGTEC→PixConsig é **cadastro institucional do município** (sem dados de tomadores). Sem PII de pessoa física.

---

## 4. O que cada lado entrega (checklist)

**PixConsig (Direção A — já proposto por vocês):**
- [ ] `GET /v1/convenios` (delta/full, paginado) + `GET /v1/convenios/{id}` + `GET /v1/health`
- [ ] `x-api-key`, OpenAPI 3.x, README (auth, paginação, caveats do `updated_at`)
- [ ] Base URL + api key para o CONSIGTEC

**CONSIGTEC (Direção A — já pronto):**
- [x] Consumidor do payload v1 (upsert idempotente por `pixconsig_convenio_id`)
- [x] Full sync diário agendado (pg_cron) + gatilho manual + importação de JSON para teste

**CONSIGTEC (Direção B — a implementar quando batermos o martelo):**
- [ ] `GET /api/integration/v1/municipios` (somente leitura, `x-api-key`, filtros `updated_since`/`origem`/`uf`)
- [ ] Gravar `pixconsig_*_id` e promover `origem_dado` na reconciliação por `codigo_ibge`

**PixConsig (Direção B):**
- [ ] Consumir o feed de municípios do CONSIGTEC e ingerir/credenciar por `codigo_ibge`

---

## 5. Perguntas para vocês (Vinny)

1. **`codigo_ibge` como chave canônica** de município entre os sistemas — topam?
2. A PixConsig consegue **ingerir municípios vindos do CONSIGTEC** (Direção B) no fluxo de credenciamento, ou isso hoje é 100% manual do lado de vocês?
3. Ao ingerir um município nosso, vocês devolvem o `pixconsig_convenio_id` **no próximo full sync** (casando por IBGE), certo? É assim que fechamos o loop sem ping-pong.
4. Cadência da Direção B: diária também, ou sob demanda quando o comercial marca um município como "pronto para credenciar"?
5. `status_comercial`/`prioridade_comercial` no feed — úteis para vocês priorizarem, ou preferem receber só o cadastro puro?

Fechadas essas, ligamos a Direção A imediatamente (só falta URL + key) e implementamos a Direção B em um ciclo.

— Sid / Claude (CONSIGTEC)
