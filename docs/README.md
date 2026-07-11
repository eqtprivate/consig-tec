# CONSIGTEC — `docs/` (índice de referência para o Claude Code)

**Leia este índice primeiro.** Ordem de leitura recomendada ao iniciar qualquer estágio:
arquitetura → roadmap v2 (mestre) → pacote do estágio atual → contrato/spec da integração daquele estágio.

---

## 1. Documentos de projeto (gerados — versionar em `docs/`)

| Arquivo | Papel | Informa |
|---|---|---|
| `CONSIGTEC_Arquitetura_Tecnica.md` | Stack e camadas: Supabase (SoR, RLS, Storage, Vault, Edge Functions), Base44 (UX), Claude Code, Resend/WhatsApp; modelo de identidade e recursos adicionais | Todos |
| `CONSIGTEC_Roadmap_v2_Enriquecido.md` | **Mestre.** 16 estágios, operação real do Grupo Raman, fluxo operacional→módulos, produto (cartão benefício/margem apartada), cessão/FIDC, modelo de dados, decisões | Todos |
| `CONSIGTEC_Estagio0_ClaudeCode.md` | Fundação: migration (schema + RLS `auth_can_access`), Edge Function do Resend, runbook, prompt | 0 |
| `CONSIGTEC_API_PixConsig_Contrato.md` | Contrato da API de convênios (co-desenvolvida): endpoints, schema, webhooks, fallback CSV, fronteira de propriedade | 1 |
| `CONSIGTEC_Roadmap_Implementacao.md` (v1) | Base histórica: convenções, modelo de dados inicial, prompts | Referência |

## 2. Fontes originais do cliente (versionar em `docs/fontes/`)

| Documento | Conteúdo | Informa |
|---|---|---|
| `Projeto_Final_CONSIGTEC...pdf` | Escopo funcional canônico (36 seções): esteiras, entidades, KPIs, LGPD, cobrança, carteiras | Todos |
| `gruporaman_institucional_junho2026.pdf` | Empresas do grupo, produto, parceiros (UY3/Kanastra/Utility), **métricas reais da carteira** (1.928 contratos, VOP, VF, PDD, concentração) | Todos, dashboards (Est. 10) |
| BPMN operacional (imagem) + `Mapeamento_Operacoes_Executivo.pdf` | Fluxo ponta a ponta por raia e as 6 etapas executivas | 1–8 |
| `Termo_Cessao_WL3_UY3_Clicksign.pdf` | Estrutura real da cessão/FIDC: cedente/cessionário/gestora, sem coobrigação, títulos, Clicksign | 8 |

## 3. Documentos a obter (destravam estágios futuros)

| Documento | Por que é necessário | Estágio |
|---|---|---|
| **CCB emitida pela UY3** | Modelar a entidade CCB com campos reais (nº, valor principal/financiado, IOF, CET, taxa, prazo, PMT, datas, liberação) | 5 |
| **Handoff/spec da UY3** (o que ela retorna) | nº da CCB, protocolo de averbação, resultado antifraude, confirmação de pagamento, CNAB retorno, termo de cessão | 5–6 |
| **API PixConsig** (docs finais) | Substituir o espelho CSV pela integração real | 1 |
| **Layout CNAB444 da UY3** | Geração/leitura de remessa e retorno | 6 |
| **Relatório-modelo da gestora** (Utility e Redwood) | Formato da conciliação — lembrando que é **por fundo** | 6, 8 |
| **Contrato de Cessão (mestre)** | Regras jurídicas/financeiras que o Termo referencia | 8 |
| **Edital/convênio exemplo** (via DOMs) | Parametrização de produto, margem apartada e comissão | 1 |

## 4. Onde guardar

- **Repositório** (`docs/` e `docs/fontes/`): documentos de projeto e fontes. É o que o Claude Code lê nativamente — **repo-first**.
- **Drive dedicado**: arquivo bruto/backup das fontes e ponto de entrada para documentos que cheguem depois (a serem copiados ao repo quando virarem referência de build).

## 5. Como subir ao GitHub

```bash
mkdir -p docs/fontes
# copie os .md gerados para docs/ e os PDFs/imagens para docs/fontes/
git add docs
git commit -m "docs: roadmap v2, arquitetura, contrato PixConsig, fundação Est.0 e fontes"
git push
```

> Convenção: quando um documento novo virar referência de build (ex.: a CCB da UY3), adicione-o em `docs/fontes/` e registre a linha correspondente nas tabelas acima, para o Claude Code sempre saber o que existe e para que serve.
