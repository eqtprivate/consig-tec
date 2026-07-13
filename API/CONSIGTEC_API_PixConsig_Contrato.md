# PixConsig ↔ CONSIGTEC — Proposta de Contrato de API (Convênios / Credenciamento)

Documento para alinhar o **desenvolvimento conjunto** da API entre os times da PixConsig e do CONSIGTEC. A PixConsig é a **fonte da verdade** do credenciamento das prefeituras; o CONSIGTEC consome os convênios e mantém apenas o *overlay* comercial de originação. Este é um ponto de partida técnico — os campos e eventos devem ser validados em workshop com a PixConsig.

---

## 1. Objetivo e escopo

- A PixConsig credencia prefeituras/entes e expõe os convênios via API.
- O CONSIGTEC sincroniza um **espelho local** desses convênios (camada anticorrupção) e referencia esse espelho em toda a esteira (CRM, margem, CCB, comissão, dashboards).
- Direção do dado: **PixConsig → CONSIGTEC** (o CONSIGTEC apenas lê; não altera o credenciamento).

## 2. Fronteira de propriedade (confirmada)

| Dado | Dono / origem |
|---|---|
| Cadastral do ente (CNPJ, nome, tipo, cidade/UF, endereço) | **PixConsig (API)** |
| Status de credenciamento, vigência | **PixConsig (API)** |
| Norma autorizadora (lei/decreto/edital) + link do DOM | **PixConsig (API)** |
| Produtos autorizados, tipo e % de margem apartada, prazos, valor máx., taxa | **PixConsig (API)** |
| **CAPAG** (classificação, data, fonte) | **PixConsig (API)** |
| **Comissão da prefeitura** (nível convênio/produto) | **PixConsig (API)** |
| **Spread** (nível convênio/produto) | **PixConsig (API)** |
| Sistema de averbação / folha, data de corte | **PixConsig (API)** |
| Rateio da comissão/spread entre canal/franquia/líder/corban/operador | **CONSIGTEC (overlay)** |
| Habilitação de canal/franquia para vender no convênio | **CONSIGTEC (overlay)** |
| Metas, campanhas, pendências/SLA de originação, KPIs comerciais | **CONSIGTEC (overlay)** |

Ou seja: a PixConsig entrega a **comissão da prefeitura** e o **spread** como o "pool" econômico do convênio; o CONSIGTEC apenas os **rateia** entre seus canais.

## 3. Modelo de dados entregue pela API

**Recurso: Convênio** (com entidade embutida ou referenciada)

```
Convenio {
  id                        // id PixConsig (chave externa no CONSIGTEC)
  entidade {
    id, cnpj, nome_oficial, tipo, natureza_juridica, cidade, uf, endereco
  }
  credenciamento {
    status               // em_credenciamento | ativo | suspenso | encerrado
    data_credenciamento
    vigencia_inicio, vigencia_fim
  }
  norma_autorizadora {
    tipo                 // lei | decreto | portaria | edital | termo
    numero, data, link_dom
  }
  capag {
    classificacao, data_consulta, fonte, observacoes
  }
  averbacao {
    sistema, forma, data_corte, contatos_operacionais[]
  }
  produtos[] {
    produto_id, nome
    tipo_margem          // apartada | principal | cartao
    percentual_margem_apartada
    prazo_min, prazo_max, valor_max
    taxa                 // a.m.
    spread
    comissao_prefeitura  // % ou valor, nível convênio/produto
  }
  version, created_at, updated_at
}
```

## 4. Endpoints REST (proposta)

| Método | Rota | Uso |
|---|---|---|
| GET | `/v1/convenios?updated_since=&status=&page=&page_size=` | Lista/delta paginada (habilita o *pull* de reconciliação) |
| GET | `/v1/convenios/{id}` | Detalhe de um convênio |
| GET | `/v1/entidades/{id}` | Detalhe da entidade (se separada do convênio) |
| GET | `/v1/produtos?convenio_id=` | Produtos autorizados de um convênio |
| GET | `/v1/health` | Disponibilidade |

Paginação por cursor ou page/page_size; `updated_since` (ISO 8601) para deltas.

## 5. Webhooks (push — proposta)

| Evento | Quando dispara |
|---|---|
| `convenio.ativado` | Convênio liberado para produção |
| `convenio.atualizado` | Qualquer alteração cadastral/produto/margem |
| `convenio.suspenso` / `convenio.encerrado` | Mudança de status |
| `produto.atualizado` | Alteração de produto/taxa/spread/comissão |
| `capag.atualizado` | Nova classificação CAPAG |

Payload: `{ event, event_id, occurred_at, convenio_id, version, data }`. Entrega por `POST` ao endpoint do CONSIGTEC, com **assinatura HMAC** (`X-Signature`), **retry com backoff** e **idempotência por `event_id`**.

## 6. Sincronização

- **Webhook** (quase tempo real) como caminho principal + **pull delta agendado** (diário, `updated_since`) como reconciliação/backstop.
- **Idempotência:** `version`/`updated_at` por convênio — o CONSIGTEC ignora eventos com `version` menor ou igual ao já persistido.
- **De-para de identidade:** `pixconsig_convenio_id` e `pixconsig_entidade_id` como chaves externas; FKs internas apontam para o espelho local.

## 7. Auth, segurança e operação

- **Auth:** OAuth2 *client_credentials* ou API key por ambiente; escopo **read-only** para o CONSIGTEC.
- HTTPS obrigatório; HMAC nos webhooks; credenciais como **secrets do Base44** (nunca no repositório).
- **Rate limits** e **erros padronizados** (JSON problem+details: 400/401/403/404/409/429/5xx).
- **Versionamento** por path (`/v1`), com política de depreciação.

## 8. Ambientes

- **Homologação (sandbox)** com dados de teste + **Produção**. O CONSIGTEC valida a integração em homologação antes de ir a produção.

## 9. Fallback CSV/manual (MVP, até a API entrar no ar)

Enquanto a API é co-desenvolvida, o espelho é populado por **planilha/CSV** (ou entrada manual) com o **mesmo schema + chave externa**, para que a virada para a API seja transparente. Layout mínimo do CSV, uma linha por produto de convênio:

```
pixconsig_convenio_id, cnpj, nome_oficial, cidade, uf, status, vigencia_inicio, vigencia_fim,
norma_tipo, norma_numero, norma_data, link_dom,
capag_classificacao, capag_data, capag_fonte,
sistema_averbacao, data_corte,
produto_id, produto_nome, tipo_margem, percentual_margem_apartada,
prazo_min, prazo_max, valor_max, taxa, spread, comissao_prefeitura
```

## 10. Entidades do CONSIGTEC nessa camada

- `Convenios` / `EntidadesCadastro` — *read model* (com `pixconsig_*_id`, `origem_dado`, `ultima_sincronizacao`, `status_sync`).
- `SincronizacoesConvenio` — log de webhooks/pulls, versão, resultado.
- `OverlayComercialConvenio` — rateio de comissão/spread, habilitação de canal, metas/campanhas (propriedade do CONSIGTEC).

## 11. Impacto no motor de comissões (Estágio 7)

A **comissão da prefeitura** e o **spread** chegam prontos da PixConsig, no nível do convênio/produto. O motor de comissões do CONSIGTEC não os recalcula — ele os toma como base do *pool* e aplica as **regras de rateio** próprias entre canal/franquia/líder/corban/operador. Toda alteração desses valores (via webhook `produto.atualizado`) deve versionar o histórico para não distorcer comissões já apuradas.

## 12. Próximos passos

1. Workshop técnico com a PixConsig para validar schema, eventos e ambientes.
2. Priorizar `GET /v1/convenios` com `updated_since` (habilita o *pull*), webhooks em seguida.
3. CONSIGTEC inicia o MVP com o espelho via CSV usando este schema, sem esperar a API.
