# CONSIGTEC — Status de Implementação (régua do roadmap)

> Linha de base atualizada em **2026-07-14**. Fonte da verdade: git (`main`);
> o Base44 sincroniza pelo git; migrações em `supabase/migrations/` (aplicadas no
> Supabase). Migrações no repo: **0001–0077**.

Legenda: ✅ feito · 🟡 parcial · ⚠️ depende de integração/dados externos · ⬜ não iniciado.

---

## 1) Núcleo do produto — Estágios 0–16 (migr. 0001–0051)
Estrutura **100% implementada**. O que resta em cada um é integração real / dados,
não arquitetura.

| # | Estágio | Estrutura | Falta (real/externo) |
|---|---------|:---:|---|
| 0 | Fundação & Setup (Auth, RLS, Resend) | ✅ | — |
| 1 | Convênios via PixConsig (ACL/espelho) | ✅ | — |
| 2 | CRM / Vendas | ✅ | (evoluído — ver §3) |
| 3 | Tomadores & Vínculos | ✅ | — |
| 4 | Margem & Averbação | ✅ | handoff UY3 real ⚠️ |
| 5 | Formalização, Antifraude & CCB | ✅ | assinatura eletrônica real ⚠️ |
| 6 | Recebíveis PMT & Conciliação | ✅ | — |
| 7 | Comissões (rateio) | ✅ | — |
| 8 | Cessão, Lastro & FIDC | ✅ | integração Kanastra/Utility ⚠️ |
| 9 | Pendências, SLA & Notificações | ✅ | SLA/escalonamento automático 🟡 |
| 10 | Dashboards executivo/investidor | 🟡 | semear carteira real (VOP/VF/PDD) ⚠️ |
| 11 | Cobrança, Default & Renegociação | ✅ | — |
| 12 | Chamados & Inconsistências | ✅ | — |
| 13 | LGPD | ✅ | — |
| 14 | Carteiras Adquiridas | ✅ | — |
| 15 | Refinanciamento | ✅ | — |
| 16 | Integrações & Portais | ✅ | APIs reais (UY3/FIDC/WhatsApp) ⚠️ |

---

## 2) Épico SaaS multi-tenant + white-label (migr. 0052–0069) — ✅
Transformou a instância única (EmpresteiCard) em **plataforma multi-cliente**.

- **Multi-tenancy** (0052–0057): `empresa_id` em tudo, RLS tenant-aware,
  superadmin cross-tenant, RPCs de escopo/dashboard por empresa.
- **Planos de acesso** (0054): Starter/Pro/Enterprise (limitam volume e módulos;
  limites **avisam**, não bloqueiam).
- **Switcher "ver como"** (superadmin) + menu admin **Clientes (CONSIGTEC)**.
- **Onboarding de cliente** (empresa + plano + admin; sem unidade).
- **PixConsig por empresa** (0059–0061): credenciais por cliente, sync carimba
  `empresa_id`, cron respeita janela por empresa, tela de credenciais.
- **Perfil do usuário** (0062) · **usuário exige empresa** na criação (exceto superadmin).
- **White-label** (0063–0066): **16 kits de cores** (layout inteiro, light/dark) +
  **logomarca clara/escura** com upload (Storage) e dimensões sugeridas.
- **Segmento do cliente** (0064) substitui o "tipo" antigo.
- **Consolidação empresa = unidade operacional** (0068): aposentou o escopo por
  franquia em leads/comissões/repasses/cobranças.
- **Menu lateral configurável por empresa** (0069): reordenar grupos/páginas + ocultar.
- **Senha**: 1º login força troca com **checklist de requisitos** ao vivo.

---

## 3) CRM (Estágio 2) — evoluído ✅ (migr. 0070)
- **Funil visual (Kanban)** nas Oportunidades (arrastar entre etapas).
- **Painel de conversão** (taxa, ciclo médio, funil, motivos de perda, ranking de operadores).
- **Agenda com tarefas/follow-ups** (`tarefas`, 0070) ligáveis a lead/oportunidade,
  com **lembrete diário por e-mail** (cron).
- Já existiam robustos: Leads & Discagem, Tomadores, Propostas, Campanhas,
  Comercial (metas por município), Painel (call center), Config.

---

## 4) Conciliação de folha — paridade BPO CONSIG (migr. 0071–0077) — ✅
Baseado na proposta **BPOPrévia/BPORetorno**. Tudo em **Financeiro** (abas).

| Fase | Solução | Migr. |
|---|---|---|
| Retorno | Conciliação contrato-a-contrato → **ok / parcial / sem_desconto / sem_contrato** | 0071 |
| Custos | Custos de processamento (linha/%/TED/fixo) → **repasse líquido** | 0072 |
| Averbadoras | Cadastro (portal, tipo de integração, dias) + vínculo com convênios | 0073 |
| Expectativa | **Gerar da carteira** ou **importar** do banco | 0074 |
| Prévia (cartão) | Criar, enviar, **capturar resultado**, **tratar críticas** (margem×valor mínimo) | 0075 |
| Datas/notificação | Lembrete nos dias de prévia/retorno (cron) | 0076 |
| Monitor | Capturado × **faltando** por competência | 0077 |
| Extração | **CSV padrão-banco** do conciliado | — |
| Logs | Auditoria em cada ação | — |

⚠️ **Único item externo:** captura viva via **RPA/API/FTP** nos portais das
averbadoras (biblioteca de robôs/layouts). O arcabouço está pronto (import
manual/CSV substitui a captura); a automação depende dos acessos reais.

---

## 5) Pendências operacionais (não é etapa — é publicação/dados)
1. **Aplicar migrações** pendentes no Supabase (0058–0077 conforme o que faltar).
2. **Publicar o frontend** no Base44 + **republicar funções** `syncPixconsig`, `criarUsuario`.
3. **Cadastrar credenciais PixConsig** por empresa.
4. **Semear dashboards** com a carteira histórica real.
5. **Integrações reais** (UY3/CNAB, Kanastra/Utility FIDC, WhatsApp) + **RPA** das averbadoras.
6. **SLA/escalonamento automático** (Est. 9).
7. **Segurança Supabase**: desligar signups + proteção de senha vazada.

## 6) Dependências externas (destravam o que resta)
- **Resend API key** (envio real de e-mail/lembretes) — em uso.
- **PixConsig** x-api-key por cliente.
- **UY3 / Kanastra / Utility / WhatsApp** — handoff manual hoje; API depois.
- **Acessos aos portais das averbadoras** — para o conector de captura (RPA/API/FTP).

## 7) Decisões arquiteturais firmadas
- Supabase Auth + RLS multi-empresa · Secrets no Base44 (service_role só no backend) ·
  PixConsig = fonte da verdade dos convênios · empresa = tenant e unidade operacional ·
  planos avisam (não bloqueiam) · superadmin nunca é bloqueado pela RLS.
