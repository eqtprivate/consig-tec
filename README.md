# CONSIGTEC

Plataforma **multi-tenant (SaaS) de crédito consignado** — sistema de registro e
orquestração da operação (Grupo Raman / Emprestei Card / PixConsig): convênios,
CRM/vendas, margem & averbação, formalização, CCB, recebíveis, comissões, cessão/FIDC,
cobrança, LGPD e dashboards. Onde parceiros externos executam (UY3, Kanastra, Utility),
o CONSIGTEC **registra e concilia**.

**Stack:** Vite + React (JSX) · Supabase (Postgres, RLS, Storage, Auth, pg_cron) ·
Edge Functions (Deno) · hospedado no **Base44** (publica/espelha no GitHub) ·
IA de leitura de documentos via **Anthropic Claude**.

## Módulos principais
- **Convênios & Produtos** — cadastro, capacidade por município, regras do decreto, e
  **Leitura de Decretos por IA** (Decretos IA + Arquivo de Decretos): extrai as regras do
  decreto/lei, compara com o cadastro do convênio (preenche / confere / diverge) e aplica
  sob conferência humana.
- **CRM / Vendas** — leads, funil Kanban, agenda, propostas, campanhas, call center.
- **Margem & Averbação** — consulta, averbações, reconciliação.
- **Formalização, Antifraude & CCB** — inclui **Leitura Automática de CCB** (IA):
  Ingestão, Ajustes da leitura, Arquivo (CCBs) — extração + conferência humana.
- **Financeiro** — recebíveis/PMT, conciliação de repasse e de folha (paridade BPO), carteira.
- **Comissões** · **Cessão/FIDC** (deságio, borderô, lastro) · **Cobrança** · **LGPD** · **Suporte**.
- **Admin** — empresas & planos (cotas/limites), usuários, personalização (white-label), menu.
- **Suporte** (`/suporte`) e **Segurança & Compliance** (`/seguranca`).

## Documentação (`docs/`)
- `CONSIGTEC_Auditoria_Externa.md` — **mapa para validação/auditoria externa** (arquitetura,
  tenancy/RLS, modelo de dados, índice de migrações, edge functions, IA de documentos,
  cotas, segurança/LGPD, status de validação).
- `STATUS.md` — **régua do roadmap** (o que está pronto/pendente, por migração).
- `CONSIGTEC_Roadmap_Implementacao.md` (v1) e `CONSIGTEC_Roadmap_v2_Enriquecido.md` (v2).
- `CONSIGTEC_Arquitetura_Tecnica.md` — arquitetura.
- `CONSIGTEC_Seguranca_Compliance_Leitura_CCB.md` — segurança/compliance da leitura de CCB.
- `CONSIGTEC_Item8_Conector_Averbacao_Plan.md` — plano do conector eConsig/Zetra.
- `VALIDACAO_PENDENTE.md` — validações end-to-end pendentes.
- `supabase/migrations/` — migrações (0001–0094). Base44 sincroniza pelo git.

---

## Base44 — desenvolvimento

Use este repositório para rodar e editar o app localmente e publicar via Base44.
Qualquer mudança no repo também reflete no Base44 Builder.

### Pré-requisitos
1. Clone o repositório pela URL Git do projeto.
2. Entre no diretório do projeto.
3. Instale dependências: `npm install`.
4. Instale a CLI do Base44: `npm install -g base44@latest`.

Docs da CLI: https://docs.base44.com/developers/references/cli/get-started/overview

### Rodar localmente
```bash
base44 dev
```
Inicia o backend local do Base44 e, quando configurado, o dev server do frontend.

### Só o frontend (backend hospedado)
```bash
npm run dev
```
Crie/atualize `.env.local`:
```bash
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=https://your-app.base44.app
```

### Qualidade
```bash
npm run lint   # eslint
npm run test   # vitest
npm run build  # vite build
```
