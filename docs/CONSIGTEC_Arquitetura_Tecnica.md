# CONSIGTEC — Arquitetura Técnica e Stack

Define os papéis de **Supabase**, **Base44**, **Claude Code**, **Resend** e demais recursos. Refina as notas de stack do roadmap v1/v2.

---

## 1. Princípio: um sistema de registro, camadas especializadas

- **Supabase (Postgres)** — **sistema de registro** de todo o dado de domínio/financeiro + lógica crítica + integrações + RLS + storage + segredos.
- **Base44** — **camada de aplicação/UX** e ferramentaria interna, que **consome** o Supabase.
- **Claude Code** — desenvolve a lógica em código (edge functions, migrations) versionada no **GitHub**.
- **Resend / WhatsApp** — comunicação transacional (e-mail e mensageria).

Regra de ouro: **evitar dupla fonte de verdade**. O dado de domínio vive no Supabase; o Base44 não mantém um banco paralelo de domínio — ele lê/escreve no Supabase via Edge Functions/PostgREST. Apenas estado puramente de UI/config pode ficar no Base44.

---

## 2. Onde usar o Supabase (por camada/situação)

| Camada / situação | Uso do Supabase |
|---|---|
| **Banco de domínio/financeiro** (system of record) | Postgres: convênios (espelho PixConsig), tomadores, vínculos, propostas, CCBs, recebíveis, **parcelas/PMT**, cessões/FIDC, repasses, conciliação, comissões, cobrança, chamados |
| **Isolamento multi-empresa** (Grupo→Empresa→Franquia→Líder→Corban) | **RLS nativa do Postgres** com claims de JWT (`auth.uid`, `empresa_id`, `franquia_id`) |
| **Lógica determinística/crítica** | **Edge Functions** (Deno/TS): motor de PMT, rateio de comissão, geração de **CNAB444**, conciliação — testáveis e versionadas |
| **Integrações e webhooks** | Edge Functions recebem/validam (HMAC) webhooks da PixConsig/UY3; adapters de sync; **pg_cron** para pull agendado |
| **Documentos** | **Supabase Storage**: CCB PDF, selfie/prova de vida, comprovantes de averbação, termos de cessão, DOMs |
| **Segredos/acessos** | **Supabase Vault**: chaves da PixConsig/UY3/Resend/WhatsApp criptografadas no Postgres |
| **Auditoria e logs LGPD** | Tabelas append-only + triggers; particionamento por volume |
| **Analytics/relatórios pesados** | Views/materialized views para KPIs (VOP, VF, curva de recebíveis, PDD, concentração por ente/UF/prazo) |
| **Jobs/filas** | **pg_cron** (agendados) + **pgmq** (filas) para CNAB, conciliação, importações, reprocessamento de webhook |
| **Realtime** (opcional) | Atualização ao vivo de pendências/esteira nos painéis |

## 3. Onde fica o Base44

Telas operacionais, esteiras/workflow, CRM, central de pendências, dashboards (lendo do Supabase), admin de usuários/perfis. Consome o Supabase via Edge Functions/PostgREST. É a camada de produtividade/UX — não o banco de domínio.

## 4. Decisão de identidade (auth) — a definir

- **Recomendado:** **Supabase Auth como provedor de identidade** (JWT). A RLS do Postgres aplica o isolamento multi-empresa de forma nativa e auditável; o Base44 autentica contra o Supabase.
- **Alternativa (app só interno):** auth do Base44 + Edge Functions repassando o contexto do usuário; RLS via service role + checagem na função. Mais simples, menos rigoroso.
- Para um sistema financeiro multi-empresa, a recomendação é a primeira.

## 5. Recursos adicionais sugeridos (priorizados)

**Essenciais no MVP/Fase 1:**
- **Supabase Storage** (documentos) e **Supabase Vault** (segredos) — nativos; resolvem o "repositório de senhas/acessos".
- **WhatsApp Business API** (Zenvia / Gupshup / Meta / Twilio) — o fluxo envia link de formalização por WhatsApp; o Resend cobre apenas e-mail.
- **CI/CD** — GitHub Actions para migrations e Edge Functions, com **testes obrigatórios** na lógica financeira (PMT, comissão, CNAB).
- **Observabilidade** — **Sentry** para erros nas Edge Functions e no app.

**Confirmar com a UY3 (pode dispensar fornecedor próprio):**
- **Assinatura eletrônica de CCB** e **prova de vida/selfie/antifraude**: o BPMN mostra a UY3 enviando o link de assinatura e fazendo antifraude. Se a UY3 é dona disso, **integramos** e não adicionamos fornecedor. Se não, adicionar **ZapSign/Clicksign** (assinatura) e **Unico/idwall** (biometria/liveness/KYC).

**Fase 2+ (cessão / investidor / escala):**
- **BI externo** — **Metabase** sobre o Postgres para relatórios executivos/investidor (EQT Private), além dos dashboards in-app.
- **Bureau de crédito/óbito** (Serasa / idwall / SIRC) — elegibilidade e eventos de default (ex.: falecimento do servidor).
- **Fila robusta** — evoluir de pgmq para Inngest/QStash se o volume de CNAB/conciliação crescer.

## 6. Reflexo no roadmap

- **Estágio 0** passa a provisionar **Supabase (Postgres + Auth + Storage + Vault)** + repositório GitHub + Base44 apontando para o Supabase; motor Resend como Edge Function.
- As "funções de backend" citadas no roadmap (PMT, comissão, Resend, adapters PixConsig/UY3, CNAB) = **Supabase Edge Functions** versionadas via Claude Code.
- A **RLS multi-empresa** passa a ser **RLS de Postgres** (não RLS do Base44).
- O espelho de convênios da PixConsig e o overlay comercial vivem no Postgres; a sincronização (webhook + pull) roda em Edge Functions.

## 7. Fluxo de uma operação pela stack (exemplo)

1. Corban origina no **Base44** (tela de proposta) → grava no **Postgres** (proposta) com RLS por franquia.
2. Consulta de margem/averbação → **Edge Function** registra/handoff (UY3) → Postgres.
3. Formalização (selfie/assinatura) → UY3 (ou fornecedor) → documentos no **Storage**, status no Postgres.
4. CCB emitida → **Edge Function** calcula/armazena **PMT** e parcelas no Postgres.
5. Cessão ao FIDC → Edge Function gera **CNAB444** (Storage) + registra termo/cessão.
6. Repasse da folha → Edge Function concilia previsto×recebido; divergência abre pendência/cobrança.
7. Eventos relevantes → **Resend/WhatsApp** via Edge Function; tudo auditado.
8. Diretoria/EQT → dashboards no Base44 (views SQL) + **Metabase** para investidor.
