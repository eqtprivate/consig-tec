# API de Convênios PixConsig → CONSIGTEC — Mapeamento e Proposta v1

**De:** Vinny / Claude (PixConsig) · **Para:** Sid / Claude (CONSIGTEC)
**Data:** 10/07/2026 · **Status:** proposta para alinhamento antes da implementação

O prompt de vocês pediu, corretamente, para mapear as entidades internas antes de codar e listar lacunas em vez de inventar valores. É exatamente o que este documento faz. Boa notícia: a PixConsig tem mais campos do que o esperado (CAPAG, margens e tipo de margem já existem no banco). A proposta abaixo entrega uma v1 honesta — só o que existe de verdade — com as lacunas explícitas para decidirmos juntos.

---

## 1. Mapeamento campo a campo (contrato pedido × dados reais)

### `entidade`
| Campo pedido | Campo PixConsig | Situação |
|---|---|---|
| `cnpj` | `cnpj` | ✅ Existe (nem toda prefeitura tem preenchido — virá `null` quando ausente) |
| `nome_oficial` | derivado de `city` + `state` ("Prefeitura Municipal de X/UF") | ⚠️ Não há campo de razão social; entregamos o nome derivado |
| `tipo` | fixo `"prefeitura"` | ✅ O sistema só gerencia municípios |
| `cidade` / `uf` | `city` / `state` | ✅ |
| `endereco` | `address` + `zipCode` | ✅ (frequentemente vazio) |
| — (bônus) | `ibgeCode`, `population`, `servidores` | ✅ **Não estavam no contrato de vocês, mas existem e são úteis — proponho incluir** |

### `credenciamento`
| Campo pedido | Campo PixConsig | Situação |
|---|---|---|
| `status` | enum `PrefeituraStatus` | ⚠️ Enums diferentes — mapeamento proposto na seção 2 |
| `data_credenciamento` | `ativaEm` (data em que virou ATIVA) | ✅ Para ativas; `null` para as demais |
| `vigencia_inicio` | `ativaEm` | ⚠️ Aproximação — não há conceito formal de vigência |
| `vigencia_fim` | — | ❌ **Não existe.** Convênios não têm prazo de encerramento no modelo atual |
| — (bônus) | `dataAtribuicao` (início do relógio de credenciamento), `createdAt` | ✅ Proponho expor |

### `norma_autorizadora`
| Campo pedido | Campo PixConsig | Situação |
|---|---|---|
| `tipo` / `numero` / `data` | — | ❌ **Não existem estruturados.** O decreto é um **arquivo** (PrefeituraFile categoria DECRETO), não campos |
| `link_dom` | URL do arquivo do decreto | ⚠️ Podemos entregar `arquivo_decreto_url` (link para o PDF no nosso storage) — não é o link do Diário Oficial |
| — | `statusDecretoCartao` (texto livre), `decretoEnviado` (boolean) | ✅ Existem e podem ser expostos |

**Lacuna a decidir:** se número/data do decreto forem essenciais para o CONSIGTEC, o caminho é adicionar campos aditivos na PixConsig e passar a coletá-los no fluxo de aprovação de decreto (que já existe — o admin lê o decreto antes de aprovar; coletar nº e data nesse momento seria natural). Não é v1.

### `capag`
| Campo pedido | Campo PixConsig | Situação |
|---|---|---|
| `classificacao` | `capag` (string: A, B, C...) | ✅ **Existe!** (nem sempre preenchido) |
| `data_consulta` / `fonte` | — | ❌ Só a classificação é armazenada, sem metadados |

### `averbacao`
| Campo pedido | Campo PixConsig | Situação |
|---|---|---|
| `sistema` | `processadora` | ⚠️ Aproximação: guardamos a processadora do cartão. Se "sistema de consignação/averbação" for outra coisa, é lacuna |
| `data_corte` | — | ❌ Não existe |
| `contatos_operacionais` | `contactName/Email/Phone` + `contatoCredenciamento` | ✅ Existem — mas ver nota de PII na seção 4 |

### `produtos[]`
| Campo pedido | Campo PixConsig | Situação |
|---|---|---|
| `tipo_margem` | `tipoMargem` | ✅ Existe (texto) |
| `percentual_margem_apartada` | `margemDecretoCartao` | ✅ Existe (% da margem do decreto p/ cartão); há também `margemDisponivel` |
| `prazo_min/max`, `valor_max` | — | ❌ Não existem |
| `taxa`, `spread`, `comissao_prefeitura` | — | ❌ **Não existem.** A PixConsig gerencia credenciamento, não parametrização de produto de crédito. (Existe `CommissionConfig`, mas é comissão interna de master/franqueado — outra coisa) |

**Ponto conceitual importante:** a PixConsig não tem entidade "produto". O que existe é **um produto implícito** (cartão benefício) com atributos de margem no nível do convênio. Proponho a v1 entregar um array `produtos` com **um item sintético** (`produto_id: "cartao-beneficio"`) carregando `tipo_margem` e as margens — e os campos financeiros (`taxa`, `spread`, `comissao_prefeitura`) como `null` declarado. Se esses valores são "de propriedade da PixConsig" como diz o prompt de vocês, hoje eles não estão no sistema — decisão conjunta: ou passam a ser cadastrados aqui (campos aditivos + tela), ou nascem no CONSIGTEC.

### `version` e `updated_at`
| Campo pedido | Situação |
|---|---|
| `updated_at` | ✅ Existe (`updatedAt`, UTC) — **com caveats sérios, ver seção 3** |
| `version` | ❌ **Não existe** e criá-lo exigiria alterar o schema — o que o próprio prompt de vocês proíbe ("não altere o modelo de dados interno"). Contradição do contrato. Proposta: v1 sem `version`; se necessário no futuro, adicionamos coluna aditiva (seguro no nosso deploy) |

---

## 2. Mapeamento de status (proposta — validar com Vinny e Sid)

| PixConsig (`PrefeituraStatus`) | API (`credenciamento.status`) |
|---|---|
| AGUARDANDO_ANALISE | `em_credenciamento` |
| AGUARDANDO_DECRETO | `em_credenciamento` |
| PROCESSO_EM_ANDAMENTO | `em_credenciamento` |
| ATIVA | `ativo` |
| INATIVA | `suspenso` |
| REPROVADA | `encerrado` |

Além do status mapeado, a v1 expõe **`status_detalhado`** com o enum interno cru (+ `decreto_enviado`), para o CONSIGTEC não perder granularidade da esteira. REPROVADA → `encerrado` é discutível (nunca chegou a ser convênio); alternativa é filtrá-las por padrão e só entregar sob `?status=encerrado`.

## 3. Delta por `updated_at` — caveats obrigatórios

O endpoint central de vocês (`?updated_since=`) vai funcionar, mas com três avisos que **precisam constar no README**:

1. **Falsos positivos:** o `updatedAt` é automático do ORM — qualquer escrita no registro o atualiza, inclusive operações administrativas (transferências entre masters, correções internas) que não mudam nada relevante para o CONSIGTEC. O consumidor deve tratar o delta como "candidatos a mudança" e comparar payloads (ou simplesmente sobrescrever o espelho, que é idempotente).
2. **Histórico poluído:** já houve atualizações em massa administrativas (ex.: reset de `data_atribuicao` em ~1.100 registros em 29/06/2026). O `updated_at` anterior a hoje não reflete "última mudança de negócio". Para a **carga inicial**, usar `GET /v1/convenios` sem `updated_since` (full sync) e só então entrar no regime de delta diário.
3. **Sem `version`:** não há como detectar mudanças perdidas além do timestamp. Para consumo diário com full-sync ocasional (ex.: semanal), é suficiente.

## 4. Escopo da v1 (proposta enxuta)

**Endpoints (todos GET, prefixo `/api/integration/v1/`):**
- `GET /v1/convenios?updated_since=&status=&page=&page_size=` — delta paginado, ordenação determinística `(updated_at, id)`, `page_size` máx. 200
- `GET /v1/convenios/{id}` — detalhe
- `GET /v1/health` — disponibilidade + versão do sistema

**Auth:** API key via header `x-api-key`, validada contra env (`INTEGRATION_API_KEY`). HTTPS já é padrão do domínio. Sem OAuth2 na v1 — são dois sistemas da mesma casa; OAuth é infraestrutura sem retorno aqui.

**Auditoria:** cada chamada registrada na trilha de auditoria da PixConsig (consumidor, endpoint, filtros, timestamp).

**PII:** contatos (nome/email/telefone da prefeitura, `mayorName`) são dados de contato institucional, mas ainda assim pessoais → **decisão conjunta:** incluir `contatos_operacionais` na v1 ou entregar só na v1.1 após definirmos o perfil de acesso do lado do CONSIGTEC. Recomendo incluir (o contrato de vocês pede e é necessidade operacional legítima), registrando a finalidade.

**Fora da v1 (adiado com justificativa):**
- **Webhooks HMAC** — consumo é diário; polling no delta resolve. Fase 2 se surgir necessidade de tempo real.
- **Sandbox separado** — só há um ambiente. Alternativa: uma segunda API key de teste que retorna apenas a prefeitura-cobaia (Cubatão/SP). Zero infra nova.
- **RFC problem+details e rate limiting formal** — erros JSON limpos com códigos corretos (400/401/404/500) sim; formalismo de RFC e rate limiter, não (consumidor único e conhecido).
- **`version` incremental** — ver seção 1.

**Entregáveis mantidos:** OpenAPI 3.x, README (auth, paginação, delta, caveats do updated_at), exemplo real de resposta.

## 5. Exemplo de resposta v1 (formato proposto, valores ilustrativos)

```json
{
  "data": [
    {
      "id": "uuid-estavel-pixconsig",
      "entidade": {
        "cnpj": "12345678000199",
        "nome_oficial": "Prefeitura Municipal de Cubatão/SP",
        "tipo": "prefeitura",
        "cidade": "Cubatão",
        "uf": "SP",
        "endereco": null,
        "codigo_ibge": "3513504",
        "populacao": 112000,
        "servidores": 8500
      },
      "credenciamento": {
        "status": "ativo",
        "status_detalhado": "ATIVA",
        "decreto_enviado": false,
        "data_credenciamento": "2026-05-12T14:03:00Z",
        "data_atribuicao": "2026-06-29T03:00:00Z",
        "vigencia_inicio": "2026-05-12T14:03:00Z",
        "vigencia_fim": null
      },
      "norma_autorizadora": {
        "tipo": "decreto",
        "numero": null,
        "data": null,
        "status_decreto": "publicado",
        "arquivo_decreto_url": "https://app.pixconsig.com.br/uploads/..."
      },
      "capag": { "classificacao": "B", "data_consulta": null, "fonte": null },
      "averbacao": {
        "sistema": "NomeDaProcessadora",
        "data_corte": null,
        "contatos_operacionais": [
          { "nome": "Fulano", "email": "rh@cubatao.sp.gov.br", "telefone": "+55...", "papel": "credenciamento" }
        ]
      },
      "produtos": [
        {
          "produto_id": "cartao-beneficio",
          "nome": "Cartão Benefício Consignado",
          "tipo_margem": "cartao",
          "percentual_margem_apartada": 5.0,
          "margem_disponivel": 3.2,
          "prazo_min": null, "prazo_max": null, "valor_max": null,
          "taxa": null, "spread": null, "comissao_prefeitura": null
        }
      ],
      "updated_at": "2026-07-09T18:22:41Z"
    }
  ],
  "pagination": { "page": 1, "page_size": 100, "total": 1365, "has_next": true }
}
```

## 6. Decisões que precisamos bater o martelo (Vinny + Sid)

1. **Mapeamento de status** (seção 2) — em especial REPROVADA e INATIVA.
2. **Contatos/PII na v1** — incluir desde já ou v1.1?
3. **Campos financeiros de produto** (`taxa`, `spread`, `comissao_prefeitura`) — passam a ser cadastrados na PixConsig (campos + tela novos) ou nascem no CONSIGTEC? Impacta quem é "dono" do dado.
4. **Número/data do decreto** — coletar no fluxo de aprovação de decreto da PixConsig (evolução natural) ou dispensar?
5. **REPROVADAs no full sync** — entregar ou filtrar por padrão?
6. **`version`** — confirmam que v1 sem ele atende, dado o full-sync ocasional?

Respondidas essas 6, a implementação da v1 é direta: rotas novas somente leitura, sem tocar no schema, deployável em um ciclo.
