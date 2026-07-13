# Relatório de Validação — Contrato PixConsig v1 (produção)

**De:** Cid / Claude (CONSIGTEC) · **Para:** Vinny / Claude (PixConsig) · **Data:** 13/07/2026
**Validado contra:** `pixconsig_v1_exemplo_8_casos.json` (resposta real de produção, v2.0.119).

## Resultado: ✅ contrato compatível — importador ajustado e validado nos 8 casos

Rodamos o mapeamento contra os 8 casos reais. **7 sincronizados, 1 ignorado (REPROVADA)**,
**6 produtos** gravados. Nenhum erro de mapeamento. Detalhe caso a caso:

| # | Município | status_detalhado | Resultado no espelho |
|---|---|---|---|
| 1 | Ananindeua/PA | ATIVA | convênio **ativo**; `tipo_margem=cartao`; margem `null`; **3 produtos** (cartão benefício, consignado, cartão crédito) |
| 2 | Guaraciama/MG | AGUARDANDO_DECRETO | inativo; primary=consignado → `tipo_margem=principal`; **1 produto** (consignado 35%); decreto_url gravado |
| 3 | Santaluz/BA | AGUARDANDO_DECRETO | inativo; `produtos: []` → nenhum produto tocado; casado por **nome+UF** (cnpj null) |
| 4 | Irará/BA | ATIVA | **ativo**; primary=cartão benefício → `tipo_margem=cartao`, margem 5%; **2 produtos** (consignado 40%, cartão benefício 5%) |
| 5 | Acajás/BA | AGUARDANDO_ANALISE | inativo; **cnpj+ibge nulos** → casado por nome+UF; sem produtos |
| 6 | Três Marias/MG | AGUARDANDO_ANALISE | inativo; sem produtos |
| 7 | Esplanada/BA | AGUARDANDO_ANALISE | inativo; decreto_url gravado; sem produtos |
| 8 | Apucarana/PR | **REPROVADA** | **ignorado** (filtro padrão) ✅ |

## Ajustes que fizemos (do nosso lado) a partir dos dados reais

1. **`produtos[]` como array + enum cru** — importador e full sync reescritos; cada produto
   vira uma linha em `produtos_convenio`. Mapeamento comercial (nosso):
   `CARTAO_BENEFICIO→cartao/cartao_beneficio` · `CARTAO_CREDITO→cartao/cartao_credito` ·
   `EMPRESTIMO_CONSIGNADO→principal/consignado`.
2. **`percentual_margem` pode vir número, `"35"` ou `""`** — passamos a **coagir para número|null**
   (vocês avisaram que os formatos são inconsistentes). `""`/string agora não quebram.
3. **`margens.{decreto_cartao,disponivel}`** no topo → `percentual_margem_apartada` / `margem_disponivel`
   (também com coerção numérica).
4. **`produtos: []`** → não apagamos nada; "vazio = sem parametrização", nunca "sem produto".
5. **CNPJ vem formatado** (`05.058.441/0001-68`) → normalizamos para dígitos.
6. **Contatos (PII, decisão 2)** — passamos a **guardar** `contatos_operacionais` em
   `entidades_cadastro.contatos` (jsonb), leitura restrita a admin (RLS). Migração `0046`.
7. **`taxa/spread/comissao/prazo/valor` = null** — confirmado, **não sobrescrevemos** (nossos).

## Observações / pequenos pontos para vocês (não bloqueiam)

- **Contato malformado** (caso Guaraciama): um item de `contatos_operacionais` veio com
  `nome` = e-mail e `email` = null. Guardamos como veio (jsonb), mas vale um saneamento aí.
- **Campos novos** não previstos no contrato: `entidade.cep` e `credenciamento.data_cadastro`.
  Não usamos ainda (sem impacto). Se quiserem que a gente persista `cep`, adicionamos.
- **`INATIVA` = 0** na base: confirmado, não tratamos como caso ativo.
- **`data_credenciamento`** às vezes null mesmo em ATIVA (ex.: Irará) — ok, usamos `data_atribuicao`/status.

## Conclusão

Contrato **validado e compatível**. Do nosso lado, falta só:
1. **A `x-api-key`** (canal seguro) → secret `PIXCONSIG_API_KEY` no backend.
2. Aplicar a migração **0046** (coluna `contatos`).

Com a chave, ligamos o **full sync diário** no mesmo dia. Direção B segue pausada aguardando a
regra de negócio de vocês (atribuição/franqueado) — sem impacto na Direção A.

— Cid / Claude (CONSIGTEC)
