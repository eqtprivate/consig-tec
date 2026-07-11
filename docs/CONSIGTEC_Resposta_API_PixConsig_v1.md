# CONSIGTEC → PixConsig — Resposta à Proposta v1 da API de Convênios

**De:** Sid / Claude (CONSIGTEC) · **Para:** Vinny / Claude (PixConsig)
**Data:** 11/07/2026 · **Status:** decisões batidas — liberado para implementar a v1

Obrigado pelo mapeamento campo a campo — ficou excelente e honesto (só o que existe de verdade, com as lacunas explícitas). Do nosso lado, **a v1 proposta atende** e é implementável como está: rotas somente-leitura, **sem tocar no schema de vocês**. Abaixo batemos o martelo nas 6 decisões e confirmamos o escopo.

---

## 1. As 6 decisões — fechadas

**1) Mapeamento de status** ✅ Aceito.
- Mantemos o mapa proposto (AGUARDANDO_* → `em_credenciamento`; ATIVA → `ativo`; INATIVA → `suspenso`; REPROVADA → `encerrado`).
- **REPROVADAs: filtrar por padrão** — só entregar sob `?status=encerrado`.
- Queremos o **`status_detalhado`** (enum interno cru) e o **`decreto_enviado`** no payload, para não perdermos granularidade da esteira.

**2) Contatos / PII na v1** ✅ Incluir na v1.
- É necessidade operacional legítima (contato de RH/folha e credenciamento). Do nosso lado, o acesso a esses campos será **restrito por perfil** e **auditado**, com a finalidade registrada (operação de originação/averbação). Podemos formalizar a finalidade por escrito se ajudar no controle de vocês.

**3) Campos financeiros do produto (`taxa`, `spread`, `comissao_prefeitura`)** ✅ **Nascem no CONSIGTEC.**
- Concordamos: isso é parametrização de **produto de crédito**, não credenciamento — não faz sentido a PixConsig criar campos/tela agora. **Não bloqueia a v1.**
- Na v1, entreguem esses campos como **`null` declarado** dentro do item de produto. Nós os gerenciamos no nosso *overlay comercial* (o "pool" de comissão/spread e o rateio entre canal/franquia/líder/corban/operador).
- Se um dia fizer sentido centralizar na PixConsig, tratamos como evolução aditiva.

**4) Número/data do decreto** ✅ Dispensar na v1.
- Usamos o **`arquivo_decreto_url`** + `status_decreto` + `decreto_enviado`. Coletar nº/data estruturados fica como **v1.1** — e a sugestão de vocês (capturar no fluxo de aprovação de decreto que já existe) é o caminho certo quando chegarmos lá.

**5) REPROVADAs no full sync** ✅ **Filtrar por padrão** (coerente com a decisão 1).

**6) `version`** ✅ v1 **sem `version`** atende.
- Adotamos a estratégia: **full sync inicial** (sem `updated_since`) → **delta diário** por `updated_at` → **full-sync semanal** de reconciliação. Tratamos o delta como *candidatos a mudança* e **sobrescrevemos o espelho** (é idempotente do nosso lado). Os três caveats do `updated_at` estão claros e aceitos — favor deixá-los no README.

---

## 2. Escopo v1 — o que confirmamos

- **Endpoints** (prefixo `/api/integration/v1/`): `GET /convenios` (delta + paginação, ordenação determinística `(updated_at, id)`, `page_size` máx. 200), `GET /convenios/{id}`, `GET /health`. ✅
- **Auth:** **`x-api-key`** por ambiente. ✅ (concordamos: OAuth2 é infra sem retorno aqui — mesma casa, consumidor único.)
- **Sandbox:** a segunda API key retornando só a prefeitura-cobaia (**Cubatão/SP**) é perfeita — zero infra nova e suficiente para validarmos a integração. ✅
- **Sem webhooks na v1** (polling diário resolve; webhooks HMAC ficam para a fase 2 se surgir necessidade de tempo real). ✅
- **Erros:** JSON limpo com códigos corretos (400/401/404/500), sem formalismo RFC. ✅
- **Auditoria** de cada chamada (consumidor/endpoint/filtros/timestamp). ✅

## 3. Campos bônus — aceitos com entusiasmo

Queremos, sim, os campos que vocês ofereceram além do contrato: **`codigo_ibge`, `populacao`, `servidores`** (ótimos para dashboards de risco/concentração), **`data_atribuicao`**, **`status_decreto`**, **`decreto_enviado`**, **`arquivo_decreto_url`** e **`margem_disponivel`**. Já preparamos o espelho local para recebê-los.

## 4. Pontos finos / pedidos pequenos

1. **`id` do convênio:** confirmam que o `id` (uuid) é **estável/imutável**? Vamos usá-lo como `pixconsig_convenio_id` (chave externa e âncora do de-para).
2. **Averbação = `processadora`?** Vocês sinalizaram como aproximação. Para nós, o relevante é o **sistema de averbação/consignação da folha**. Se `processadora` for outra coisa, tudo bem entregar assim (tratamos como referência) — só queremos registrar a diferença para não confundirmos com o averbador da folha.
3. **`/health`:** incluir a **versão do sistema** e um **timestamp do servidor (UTC)** ajuda nossos logs de sync. Confirmamos que todos os timestamps vêm em **UTC** (vocês já indicaram).
4. **Produto sintético:** o array `produtos[]` com um item `cartao-beneficio` carregando `tipo_margem`, `percentual_margem_apartada` e `margem_disponivel` (e financeiros `null`) está perfeito para nós.

## 5. Próximos passos propostos

1. **PixConsig:** seguir com a implementação da v1 (rotas read-only, sem tocar no schema) e nos enviar: (a) a **`x-api-key` de sandbox** (Cubatão/SP), (b) o **OpenAPI 3.x** e (c) o **README** (auth, paginação, delta e os caveats do `updated_at`).
2. **CONSIGTEC:** o espelho + overlay + log de sincronização já estão modelados no nosso Postgres. Assim que a sandbox estiver de pé, ligamos o **consumidor** (pull *full* + *delta*, de-para por `pixconsig_convenio_id`, sobrescrita idempotente). Até lá, seguimos populando o espelho por **CSV no mesmo schema**, para a virada ser transparente.
3. Marcar um **checkpoint rápido** após a primeira resposta do endpoint em sandbox, para validarmos o payload real contra o espelho.

Com as 6 decisões acima, do nosso lado **não há bloqueio** — podem tocar a v1. Qualquer ajuste, seguimos por aqui.

Abraço,
**Sid / Claude — CONSIGTEC**
