# Prompt — Build da API de Convênios (PixConsig → CONSIGTEC)

Cole o bloco abaixo no Claude Code que atua sobre o sistema da **PixConsig**. Ele é autocontido: traz o contexto, o contrato de dados e os requisitos de engenharia.

---

## PROMPT (copie a partir daqui)

**Contexto.** Você atua sobre o sistema da PixConsig, que gerencia o **credenciamento de prefeituras** para crédito consignado (cartão benefício). Precisamos expor os dados de convênios/credenciamento por meio de uma **API REST somente leitura**, consumida diariamente por um sistema parceiro (CONSIGTEC). A PixConsig é a **fonte da verdade**; o consumidor apenas lê e espelha. **Não altere o modelo de dados interno** — crie apenas uma camada de leitura que mapeia os dados existentes para o contrato abaixo.

**Objetivo.** Permitir leitura incremental diária (delta) dos convênios e seus produtos, com dados suficientes para o parceiro espelhar e operar a distribuição comercial por cima.

**Recurso principal — Convênio (JSON de resposta):**
```json
{
  "id": "string (id interno da PixConsig, estável)",
  "entidade": { "cnpj": "", "nome_oficial": "", "tipo": "", "cidade": "", "uf": "", "endereco": "" },
  "credenciamento": {
    "status": "em_credenciamento|ativo|suspenso|encerrado",
    "data_credenciamento": "ISO-8601",
    "vigencia_inicio": "ISO-8601",
    "vigencia_fim": "ISO-8601"
  },
  "norma_autorizadora": { "tipo": "lei|decreto|portaria|edital|termo", "numero": "", "data": "ISO-8601", "link_dom": "" },
  "capag": { "classificacao": "", "data_consulta": "ISO-8601", "fonte": "" },
  "averbacao": { "sistema": "", "data_corte": "", "contatos_operacionais": [] },
  "produtos": [
    {
      "produto_id": "", "nome": "",
      "tipo_margem": "apartada|principal|cartao",
      "percentual_margem_apartada": 0,
      "prazo_min": 0, "prazo_max": 0, "valor_max": 0,
      "taxa": 0, "spread": 0, "comissao_prefeitura": 0
    }
  ],
  "version": 1,
  "updated_at": "ISO-8601"
}
```

**Endpoints (versão `/v1`):**
- `GET /v1/convenios?updated_since=<ISO-8601>&status=<opcional>&page=<n>&page_size=<n>` — **delta paginado**. Retorna convênios com `updated_at` maior que `updated_since`, ordenados por (`updated_at`, `id`). É o endpoint central do consumo diário.
- `GET /v1/convenios/{id}` — detalhe de um convênio.
- `GET /v1/health` — disponibilidade.

**Requisitos técnicos:**
- **Somente leitura** (GET). Nenhuma escrita pelo consumidor.
- **Delta confiável:** todo registro DEVE expor `updated_at` (timestamp UTC da última alteração) e `version` (incremental por convênio). Sem isso, o consumo incremental não é confiável.
- **Paginação estável** (cursor ou page/page_size) com ordenação determinística por (`updated_at`, `id`).
- **Auth somente leitura:** OAuth2 *client_credentials* **ou** API key por ambiente; HTTPS obrigatório.
- **Formato:** JSON; timestamps ISO-8601 em UTC; enums documentados (status, tipo_margem, tipo de norma).
- **Erros:** JSON no padrão *problem+details*; códigos corretos (400/401/403/404/429/5xx); rate limiting documentado.
- **Ambiente de homologação (sandbox)** com dados de teste, além de produção.
- **Webhooks (opcional, recomendado):** `POST` para uma URL do consumidor, com assinatura **HMAC** (header `X-Signature`), nos eventos `convenio.ativado|atualizado|suspenso`, `produto.atualizado`, `capag.atualizado`; payload `{ event, event_id, occurred_at, convenio_id, version, data }`; retry com backoff e `event_id` para idempotência.

**Fronteira de dados.** A API entrega **CAPAG, comissão da prefeitura e spread** — a PixConsig é dona desses valores no nível do convênio/produto. O consumidor faz o rateio comercial por baixo disso; você **não** precisa modelar essa distribuição.

**Restrições.** Não exponha PII além do listado; não permita escrita; não altere o schema interno existente — apenas a camada de leitura/mapeamento.

**Entregáveis:**
1. Os endpoints acima implementados sobre os dados existentes.
2. Especificação **OpenAPI 3.x** do serviço.
3. Autenticação configurada (read-only) e ambiente de homologação com dados de exemplo.
4. README de uso (auth, exemplos de request/response, paginação, delta).

**Comece** mapeando as entidades internas do sistema atual para o JSON do Convênio acima. Onde um campo não existir hoje (por exemplo, se `spread`, `comissao_prefeitura` ou `capag` não forem armazenados como aqui), **liste-o como lacuna para decidirmos juntos — não invente valores nem crie dados fictícios**. Ao final, entregue a especificação OpenAPI e um exemplo real de resposta do `GET /v1/convenios`.

## FIM DO PROMPT

---

**Observações para você (lado CONSIGTEC), não enviar:**
- Este prompt é o espelho executável do `CONSIGTEC_API_PixConsig_Contrato.md`. Quando o dev da PixConsig entregar a OpenAPI + um exemplo de resposta, valide contra o contrato e ajuste o adapter do Estágio 1.
- O ponto que mais importa cobrar é `updated_at` + `version` por registro — é o que viabiliza a leitura diária incremental e a idempotência do espelho.
- Se eles reportarem lacunas (campos que não existem hoje), isso vira uma decisão conjunta: ou eles passam a capturar, ou o CONSIGTEC trata como opcional/nulo até existir.
