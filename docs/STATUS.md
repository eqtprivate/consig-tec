# CONSIGTEC — Status de Implementação (régua do roadmap)

> Linha de base atualizada em **2026-07-15**. Fonte da verdade: git (`main`);
> o Base44 sincroniza pelo git; migrações em `supabase/migrations/` (aplicadas no
> Supabase). Migrações no repo: **0001–0080**.

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

## 5) Ingestão e Leitura Automática de CCB (migr. 0078–0080) — ✅ código · ⚠️ falta configurar secrets
Módulo em **Formalização ▸ Ingestão de CCB**. Recebe o PDF e **nada é gravado sem
aprovação humana** — a aprovação cria CCB + contrato + parcelas (PMT).

- **Fluxo**: upload do PDF → **extração via Claude** (leitura nativa do PDF, tool
  `extrair_ccb`) → **matching** (duplicata / completar venda / novo registro) →
  **validações** (recalcula PMT, valor×proposta, dígito do CPF, coerência) →
  status **aguardando conferência**.
- **Conferência humana**: tela com **PDF lado a lado** com o extraído × o sistema,
  divergências destacadas, seleção de ação, **aprovar/rejeitar** (justificativa
  obrigatória quando há divergência crítica).
- **Idempotência**: hash SHA-256 do arquivo (um mesmo PDF entra uma vez por empresa).
- **Espelho Google Drive** (best-effort, opcional): pasta privada por empresa/ano;
  **NUNCA** afeta a CCB. **Cron de retry** a cada 30 min (0079) reenvia os pendentes.
- **Badge no menu** (0080): contador de **CCBs aguardando conferência** por empresa
  no subitem Ingestão (e somado no grupo Formalização).
- **Isolamento**: RLS `empresa_id = auth_empresa_id()`; bucket privado `ccb-docs`.

**Componentes**: migr. `0078` (tabela `ingestoes_documento`, bucket, RLS, RPC
`aplicar_ingestao_ccb`), `0079` (cron do espelho), `0080` (contador do badge);
Edge Functions `ingerir_ccb`, `aprovar_ingestao`, `espelhar_drive`; front
`IngestaoCCB.jsx` + `api/ingestao.js`.

> 🔴 **PENDENTE PARA ENTRAR EM PRODUÇÃO — configurar secrets no Base44 e publicar
> as 3 Edge Functions.** Sem isso, o upload não extrai. Ver §6, item 8.

---

## 6) Pendências operacionais (não é etapa — é publicação/dados/config)
1. **Aplicar migrações** pendentes no Supabase (conforme o que faltar até 0080).
2. **Publicar o frontend** no Base44 + **republicar funções** `syncPixconsig`, `criarUsuario`.
3. **Cadastrar credenciais PixConsig** por empresa.
4. **Semear dashboards** com a carteira histórica real.
5. **Integrações reais** (UY3/CNAB, Kanastra/Utility FIDC, WhatsApp) + **RPA** das averbadoras.
6. **SLA/escalonamento automático** (Est. 9).
7. **Segurança Supabase**: desligar signups + proteção de senha vazada.
8. 🔴 **[EM ABERTO] Secrets da Ingestão de CCB + publicar Edge Functions.** Núcleo pronto; falta:
   - **Essenciais**: `ANTHROPIC_API_KEY` (leitura da CCB), `INGESTAO_SYNC_TOKEN`
     (você inventa), `SUPABASE_ANON_KEY`, `FUNCTIONS_BASE_URL`
     (`https://consigtec.com.br/api/functions`). Confirmar `SUPABASE_URL` /
     `SUPABASE_SERVICE_ROLE_KEY` (já costumam existir).
   - **Opcional (Drive)**: `GOOGLE_SA_JSON`, `GOOGLE_DRIVE_ROOT_FOLDER_ID` +
     Vault `espelhar_drive_url` e `ingestao_sync_token`.
   - **Publicar** `ingerir_ccb`, `aprovar_ingestao`, `espelhar_drive`.

## 7) Dependências externas (destravam o que resta)
- **Anthropic API key** (leitura automática de CCB) — **pendente** (§6.8).
- **Resend API key** (envio real de e-mail/lembretes) — em uso.
- **PixConsig** x-api-key por cliente.
- **UY3 / Kanastra / Utility / WhatsApp** — handoff manual hoje; API depois.
- **Acessos aos portais das averbadoras** — para o conector de captura (RPA/API/FTP).
- **Google Drive** (service account) — só para o espelho da CCB (opcional).

## 8) Decisões arquiteturais firmadas
- Supabase Auth + RLS multi-empresa · Secrets no Base44 (service_role só no backend) ·
  PixConsig = fonte da verdade dos convênios · empresa = tenant e unidade operacional ·
  planos avisam (não bloqueiam) · superadmin nunca é bloqueado pela RLS ·
  **ingestão de CCB com aprovação humana obrigatória** (nada grava sem conferência).

## 9) Correções recentes (hotfixes)
- **Login travando em loading infinito** (2026-07-15): causa era
  `ReferenceError: AREA_SUBITEMS is not defined` no `Sidebar.jsx` (import faltando)
  — como a Sidebar monta em toda página logada, quebrava o app. **Corrigido.**
  Somadas duas redes de segurança nos contextos de auth (liberam o spinner em 15s
  se algo travar no boot) para evitar "loading infinito" no futuro.
