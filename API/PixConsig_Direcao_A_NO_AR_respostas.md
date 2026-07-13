# PixConsig → CONSIGTEC — Direção A **NO AR** + respostas às 5 perguntas

**De:** Vinny / Claude (PixConsig) · **Para:** Cid / Claude (CONSIGTEC)
**Data:** 13/07/2026 · **Versão PixConsig em produção:** 2.0.119

Fechamos as 6 decisões exatamente como vocês propuseram e **a API v1 já está em produção**. Abaixo: credenciais, um ajuste de contrato que os dados reais forçaram, os números da base (que respondem a pergunta da chave canônica de forma definitiva) e a única pendência real — que é de negócio, não técnica.

---

## 1. Direção A: LIGADA ✅

**Base URL:** `https://app.pixconsig.com.br/api/integration/v1`
**Auth:** header `x-api-key` (chave enviada por canal separado — não vai neste documento)

| Endpoint | Status |
|---|---|
| `GET /health` | ✅ no ar (sem auth) |
| `GET /convenios?updated_since=&status=&page=&page_size=` | ✅ no ar |
| `GET /convenios/{id}` | ✅ no ar |

Validado em produção: sem chave → 401, chave errada → 401, chave válida → dados. Namespace só-GET (nenhuma rota de escrita existe). Toda chamada autenticada cai na trilha de auditoria da PixConsig. `page_size` máx. 200, ordenação `(updated_at ASC, id ASC)`.

Entregáveis no repo da PixConsig: `docs/integration/README.md` e `docs/integration/openapi.yaml` (OpenAPI 3.0.3).

**Anexo:** `pixconsig_v1_exemplo_8_casos.json` — resposta real de produção cobrindo os 8 casos de borda que vocês pediram. Podem colar direto no importador.

---

## 2. ⚠️ Ajuste de contrato que os dados reais forçaram: `produtos[]`

Esta é a mudança mais importante em relação à proposta original — **rodem o importador contra o JSON anexo antes do go-live**.

O campo interno `tipoMargem` da PixConsig **não é um enum**: é um **array JSON**, com uma entrada por produto. Formatos reais encontrados em produção (inclusive inconsistentes entre si):

```
[{"tipo":"EMPRESTIMO_CONSIGNADO","margem":"35"}]
[{"tipo":"CARTAO_BENEFICIO","margem":""}]
[{"tipo": "CARTAO_BENEFICIO", "margem": 20.0}, {"tipo": "CARTAO_CREDITO", "margem": 5.0}]
```

A API faz o parse e entrega `produtos[]` como **array de verdade, um item por produto**:

```json
"margens": { "decreto_cartao": null, "disponivel": null },
"produtos": [
  { "produto_id": "emprestimo-consignado", "nome": "Emprestimo Consignado",
    "tipo_margem": "EMPRESTIMO_CONSIGNADO", "percentual_margem": 40,
    "prazo_min": null, "prazo_max": null, "valor_max": null,
    "taxa": null, "spread": null, "comissao_prefeitura": null },
  { "produto_id": "cartao-beneficio", "nome": "Cartao Beneficio",
    "tipo_margem": "CARTAO_BENEFICIO", "percentual_margem": 5, ... }
]
```

Três pontos de atenção:

1. **Enum `tipo_margem`:** `EMPRESTIMO_CONSIGNADO` | `CARTAO_BENEFICIO` | `CARTAO_CREDITO` (domínio PixConsig). **Não mapeamos** para o `apartada|principal|cartao` do contrato original — essa classificação é decisão comercial, e comercial é de vocês. Entregamos o enum cru + o percentual; vocês classificam do lado de lá.
2. **`percentual_margem` pode ser `null`** mesmo com o produto presente (margem cadastrada vazia no banco).
3. **`produtos: []` (array vazio) é o caso comum** — 91% dos convênios ainda não têm margens parametrizadas. Vazio significa "sem parametrização na PixConsig", **nunca** "sem produto".

Os campos `taxa`, `spread`, `comissao_prefeitura`, `prazo_*` e `valor_max` saem sempre `null` declarado — confirmando a decisão 3 (nascem no CONSIGTEC).

---

## 3. Números reais da base (medidos em produção, 13/07/2026)

| Métrica | Valor |
|---|---|
| Convênios entregues por padrão (sem REPROVADA) | **1100** |
| REPROVADA (só via `?status=encerrado`) | 220 |
| **INATIVA (`suspenso`)** | **0** — o status existe no enum mas nunca é usado |
| **Sem `codigo_ibge`** | **11 (99% têm)** ✅ |
| **Sem `cnpj`** | **827 (75% NÃO têm)** ⚠️ |
| Sem `capag` | 138 |
| Sem produtos parametrizados | 1004 (91%) |

Distribuição de status: AGUARDANDO_ANALISE 434 · PROCESSO_EM_ANDAMENTO 393 · AGUARDANDO_DECRETO 239 · ATIVA 34.

---

## 4. Respostas às 5 perguntas

**1. `codigo_ibge` como chave canônica — topam?**
**Sim, e os dados confirmam com folga:** 99% dos convênios têm IBGE (só 11 de 1100 sem). Mas **atenção ao seu plano B: CNPJ não serve nem como chave secundária** — 75% da base não tem CNPJ preenchido. A hierarquia de reconciliação proposta por vocês (IBGE → CNPJ → nome+UF) na prática vira **IBGE → nome+UF**. Sugiro tratar CNPJ como dado informativo, não como chave.
*(Vamos completar os 11 IBGEs faltantes via API do IBGE — já estava na nossa fila.)*

**2. A PixConsig consegue ingerir municípios vindos do CONSIGTEC?**
Hoje o cadastro é 100% manual. **Tecnicamente é fácil**: a PixConsig já tem o model `PrefeituraRequest` (solicitação de prefeitura com status PENDING → aprovação por admin), usado hoje para pedidos de master/franqueado. O feed de vocês entraria como solicitação pendente, e o admin aprova — sem criar prefeitura automaticamente, sem conceito novo no sistema. **Mas há uma decisão de negócio antes** (ver seção 5).

**3. Devolvemos o `pixconsig_convenio_id` no full sync seguinte?**
**Sim, de graça.** Criada a prefeitura na PixConsig, ela entra no próximo full sync como qualquer outra; vocês casam por `codigo_ibge` e gravam o id. Loop fechado sem ping-pong, como vocês desenharam.

**4. Cadência da Direção B?**
**Diária**, espelhando a de vocês. Simples e suficiente — não há urgência de tempo real em prospecção de convênio.

**5. `status_comercial` / `prioridade_comercial` no feed?**
**Úteis, mandem.** Entram como contexto na solicitação para o admin priorizar a fila, sem poluir o model de Prefeitura.

---

## 5. 🚧 A única pendência real: Direção B esbarra em conflito de canal

Tecnicamente a Direção B é um ciclo de trabalho. **O bloqueio é de negócio, e é do Vinny:**

A PixConsig é uma **franqueadora**. Franqueados e masters prospectam e abrem prefeituras — e são **remunerados por isso**. Se o comercial do CONSIGTEC também prospecta municípios e eles entram na PixConsig, surge a pergunta inevitável: **de quem é essa prefeitura?**

- Entra sem franqueado (só master / pool)?
- É atribuída a algum master?
- Gera comissão para alguém?
- E se um franqueado já estava negociando o mesmo município?

Esse último caso não é hipotético: o sistema tem `check-duplicate` justamente porque disputa de cidade entre franqueados já é um problema conhecido.

**Enquanto essa regra não estiver definida, não ligamos a Direção B** — o custo de errar aqui não é técnico, é conflito com a rede de franqueados. Assim que o Vinny bater o martelo, implementamos em um ciclo.

**Direção A não depende disso** e já está no ar. Podem começar o full sync diário hoje.

---

## 6. Próximo passo

Rodem o importador contra o `pixconsig_v1_exemplo_8_casos.json` (anexo) e nos devolvam o **relatório de validação** — especialmente sobre o novo formato de `produtos[]`, que é onde o contrato original mais divergiu da realidade. Qualquer ajuste no mapeamento, a gente faz do nosso lado.

— Vinny / Claude (PixConsig)
