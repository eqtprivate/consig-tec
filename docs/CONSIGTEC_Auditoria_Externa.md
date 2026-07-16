# CONSIGTEC — Mapa para Validação e Auditoria Externa

> **Versão:** 2026-07-16 · **Escopo:** plataforma multi-tenant de crédito consignado
> (Grupo Raman / Emprestei Card / PixConsig). Este documento é o ponto único de entrada
> (app **v1.36.0**, migrações até **0097**) para um avaliador/auditor externo entender **o que o sistema faz, como os dados são
> tratados e protegidos, e como cada afirmação pode ser verificada**. Complementa
> `CONSIGTEC_Arquitetura_Tecnica.md`, `STATUS.md`, `CONSIGTEC_Seguranca_Compliance_Leitura_CCB.md`
> e a página interna `/seguranca`.

---

## 1. Objetivo do sistema

O CONSIGTEC é o **sistema de registro e orquestração** da operação de crédito consignado:
governa convênios, CRM/vendas, tomadores, margem/averbação, formalização, CCB, recebíveis,
comissões, cessão/FIDC, cobrança, LGPD e dashboards. Onde parceiros externos executam
(UY3 emite CCB e paga; Kanastra/Utility operam o FIDC), o CONSIGTEC **registra e concilia**.
É **multi-tenant**: cada empresa cliente vê apenas os seus dados; a operadora (CONSIGTEC)
tem um papel de superadmin para suporte.

## 2. Arquitetura (componentes e fronteiras)

| Camada | Tecnologia | Papel |
|---|---|---|
| Frontend | Vite + React (JSX) | UI/UX, workflows, conferência humana |
| Hospedagem/app | **Base44** | serve o app e as Edge Functions; espelha o código no GitHub ao publicar |
| Banco de dados | **Supabase / Postgres** | fonte da verdade; **RLS** por empresa; `pg_cron` |
| Backend serverless | **Edge Functions (Deno)** | operações privilegiadas (service role), IA, integrações |
| Armazenamento | **Supabase Storage** (bucket privado `ccb-docs`) | PDFs de CCB e de decretos, acesso só por URL assinada |
| IA de documentos | **Anthropic Claude** (Messages API, PDF nativo + tool use) | extração estruturada de CCBs e decretos |
| E-mail | **Resend** | senhas temporárias, lembretes, notificações |

**Segredos** (chaves de API) ficam **apenas** nos *secrets* do Base44/Supabase, nunca no
código nem no repositório: `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_ANON_KEY`, `RESEND_API_KEY`, x-api-key da PixConsig por empresa.

## 3. Multi-tenancy e controle de acesso (RLS)

O isolamento entre empresas é imposto **no banco** por Row-Level Security, não apenas na UI.
Funções auxiliares (SECURITY DEFINER, `search_path=public`) usadas nas políticas:

- `auth_empresa_id()` — empresa do usuário autenticado.
- `auth_is_superadmin()` — operador CONSIGTEC; **sempre** passa nas políticas (nunca é
  bloqueado por RLS, garantindo suporte/administração).
- `auth_is_empresa_admin()` — admin da própria empresa.
- `auth_empresa_efetiva(p_empresa)` — empresa em foco (superadmin pode "ver como" empresa X).
- `auth_plano_tem_modulo(area)` — entitlement de módulo pelo plano da empresa.

Padrão das políticas: `USING (auth_is_superadmin() OR empresa_id = auth_empresa_id())`.
Papéis (`usuarios.role`): `superadmin`, `admin`, operacionais. Áreas/telas liberadas por
plano (`planos.modulos[]`). Cadastro de empresas/planos é exclusivo de superadmin.

## 4. Modelo de dados e índice de migrações

Migrações versionadas em `supabase/migrations/` (numeradas até **0094**), aplicadas no
Supabase e espelhadas no git — **cada mudança de schema é rastreável por arquivo**. Índice
temático das principais:

| Migração | Domínio |
|---|---|
| `0002` | Estágio 1 — crédito: `convenios`, `clientes`, `propostas`, produtos |
| `0029` | CCB gera contrato + cronograma (PMT) |
| `0054` | Planos de acesso (`planos`, limites, `modulos[]`, entitlement) |
| `0060` | Unicidade de convênio por empresa (chave PixConsig) |
| `0073` | Averbadoras |
| `0078` | **Ingestão de CCB** (`ingestoes_documento`, bucket `ccb-docs`, RPC `aplicar_ingestao_ccb`) |
| `0080` | Contador operacional de ingestão |
| `0081` | **Logs de acesso do superadmin** (rastreabilidade de suporte) |
| `0082` | Hardening de auditoria + branding |
| `0083` | **Decreto como dado**: colunas de regra do convênio |
| `0084` | Executividade da CCB (Lei 10.931) |
| `0085` | Repasse perdido + status vivo por parcela |
| `0086` | Motor de travas + relógio dos 30 dias |
| `0087` | Cessão: deságio, coobrigação, bordereau |
| `0088` | Métricas de carteira + importador histórico |
| `0089` | Ajustes da leitura de CCB (config por empresa + log de tentativas) |
| `0090` | Persistência dos campos ricos da CCB + `dados_extraidos` jsonb |
| `0091` | Arquivamento (Storage organizado + espelho Drive por empresa) |
| `0092` | **Cota/metering por plano** (leituras/mês, armazenamento, documentos) |
| `0093` | Gestão da ingestão (excluir tentativas/ingestões, filtros) |
| `0094` | **Ingestão de decretos** (`convenio_id` na ingestão, colunas de regra + `decreto_dados` jsonb, RPC `aplicar_regras_decreto`) |
| `0095` | **Documentos de Superadmin** (`documentos_admin` com RLS só-superadmin; `get_documento_admin` com leitura auditada em `logs_acesso`; `salvar_documento_admin`) |
| `0096` | Fix: `get_documento_admin` grava o log com as colunas reais de `logs_acesso` (defensivo) |
| `0097` | Reconciliação de `logs_acesso` (superset de colunas) + `registrar_log_acesso` gravando nas colunas reais — restaura a **trilha de impersonação** |

## 5. Edge Functions (Deno) — inventário

| Função | Papel | Autorização |
|---|---|---|
| `ingerir_ccb` | Lê a CCB (IA), valida, gera sugestão; gate de cota antes de gastar IA | admin/superadmin |
| `aprovar_ingestao` | Aplica a CCB conferida (cria CCB+contrato+parcelas) e enriquece | admin/superadmin |
| `ingerir_decreto` | Lê o decreto (IA), extrai regras, casa convênio; gate de cota | admin/superadmin |
| `aprovar_decreto` | Aplica as regras conferidas ao convênio (`aplicar_regras_decreto`) | admin/superadmin |
| `espelhar_drive` | Espelha o PDF numa pasta do Drive da empresa (best-effort) | admin/superadmin |
| `syncPixconsig` | Sincroniza convênios da PixConsig | por empresa |
| `dispatchNotificacao` | Dispara e-mails (Resend) | serviço |
| `criarUsuario` / `adminUsuario` | Provisionamento/gestão de usuários | superadmin/admin |
| `municipios` | Suporte de dados (municípios) | leitura |
| `supabaseConfig` | Config de runtime do cliente | leitura |

Todas exigem `Authorization: Bearer <token>` (respondem **401** sem sessão) e checam papel
antes de qualquer efeito. As de escrita usam service role internamente, mas aplicam as
regras de negócio com o **contexto do usuário** (RLS válida) via `userClient`.

## 6. Ingestão de documentos por IA (CCB e Decretos)

Princípio central: **a IA propõe, o humano decide**. Nada é gravado no negócio sem
conferência e aprovação humana.

**Pipeline comum:** upload do PDF → hash SHA-256 (idempotência) → **gate de cota** →
Storage privado (`empresa/…/hash.pdf`) → extração pela Claude Messages API (bloco
`document` nativo + `tool_use` com schema tipado; campos ausentes retornam `null`, nunca
inventados) → registro de **tentativa** (modelo, tokens, custo, duração, confiança) →
**tela de conferência** → aprovação humana → gravação atômica via RPC + **auditoria**.

**CCB** (`extrair_ccb`, ~45 campos): identificação, devedor, endereço, convênio,
credor/correspondente, condições financeiras, dados bancários. Recalcula PMT, valida CPF,
compara com a proposta; divergências abaixo da confiança mínima forçam revisão. Ao aprovar,
preenche `clientes`/`ccbs` (COALESCE) e guarda o JSON íntegro em `ccbs.dados_extraidos`.

**Decreto** (`extrair_decreto`): nº/data, ente/UF, lei base, margem total/cartão, prazo
máximo, adiantamento, recomposição, reposição ao erário, tipos de consignação permitidos,
consignatárias. A conferência **casa o decreto a um convênio** e faz **comparação
campo-a-campo com o cadastro**:

- **preenche** — cadastro vazio → a regra será preenchida;
- **confere** — extraído igual ao cadastrado;
- **DIVERGENTE** — extraído ≠ cadastrado → conflito realçado; **exige justificativa** para
  aplicar (trava crítica), recalculando ao vivo ao trocar de convênio/editar valores.

Ao aprovar, `aplicar_regras_decreto` grava as regras no `convenios` com proveniência
(`decreto_numero`, `decreto_data`, `decreto_dados` jsonb, `regras_origem='decreto'`,
`regras_atualizadas_em`). Tela **Arquivo de Decretos**: banco, KPIs, busca e detalhe.

## 7. Cotas / metering por plano

Cada plano define tetos: **leituras de documento/mês**, **armazenamento (MB)** e
**documentos totais** (`planos.limite_leituras_ccb_mes`, `limite_armazenamento_mb`,
`limite_documentos`). A RPC `uso_ingestao_empresa()` calcula uso × limites; `ingerir_ccb` e
`ingerir_decreto` **recusam com HTTP 402 antes de gastar IA/armazenamento** quando a empresa
excede o teto. Superadmin e empresa sem plano nunca são bloqueados. Tokens/custo são
exibidos (informativo). Editor de planos no admin; banner/cartão de uso na UI.

## 8. Segurança e proteção de dados (LGPD)

- **Armazenamento**: PDFs em bucket **privado** (`ccb-docs`); acesso apenas por **URL
  assinada temporária** (1h) ou via service role. RLS de Storage restringe a admins da
  empresa. Criptografia em repouso e em trânsito pela infraestrutura Supabase.
- **Minimização/finalidade**: extração limitada aos campos necessários à originação/registro.
- **Rastreabilidade**: tabela `auditoria` (quem aprovou/rejeitou, valores), **log de acesso
  do superadmin** (0081), **log de tentativas de ingestão** (modelo, tokens, custo, tempo).
- **Antifraude**: idempotência por hash (mesmo arquivo não entra 2×), recálculo de PMT,
  validação de CPF, cruzamento com a proposta, trava por confiança, e conferência humana
  obrigatória antes de qualquer gravação.
- **Subprocessadores**: Anthropic (leitura de documento), Supabase (dados/arquivos), Base44
  (hospedagem), Resend (e-mail), Google Drive (espelho opcional). Detalhamento e base legal
  na página interna **`/seguranca`** e em `CONSIGTEC_Seguranca_Compliance_Leitura_CCB.md`.
- **Segredos** nunca versionados; ficam nos secrets do Base44/Supabase.
- **Endurecimento pendente (operacional)**: desativar signups públicos no Supabase e ativar
  proteção de senha vazada (ver §10).

## 9. Rastreabilidade e auditoria interna

Todo evento sensível deixa trilha: aprovações/rejeições de ingestão, aplicação de regras de
decreto, acessos de superadmin, e cada leitura de IA (com custo). Um auditor consegue
reconstruir "quem fez o quê, quando e a que custo" a partir de `auditoria`,
`ingestao_tentativas` e dos logs de acesso.

## 10. Status de validação (evidências)

| Item | Status | Evidência |
|---|---|---|
| Leitura de CCB (0078–0093) | ✅ produção | chave Anthropic ativa; extração real de CCB validada; custo medido (Haiku ~R$0,25) |
| Persistência + jsonb da CCB (0090) | ✅ | RPC `enriquecer_ccb_dados`; colunas migradas |
| Cota/metering (0092) | ✅ construído | RPC `uso_ingestao_empresa`; gate 402 no backend |
| Ingestão de decretos (0094) | ✅ construído + validado | schema aplicado (13/13 colunas, `convenio_id`, RPC); funções 401; **extração real do Decreto 4.572/2019 de Manaus com todos os campos-alvo corretos** (40%/10%, 96m, 20%, 48h, 1/3) por ~R$0,02 |
| Comparação/validação decreto×convênio | ✅ | UI classifica preenche/confere/DIVERGENTE; trava de justificativa |
| Arquivo de Decretos | ✅ | tela + `api/decretosArquivo.js` |
| Segurança/Compliance in-app | ✅ | páginas `/seguranca` e `/suporte` |

**Pendências para expor ao usuário final:** *Publish* do frontend no Base44; (opcional)
`select backfill_tamanho_ccb();`; teste de bloqueio de cota pela UI; hardening de auth no
Supabase. Detalhe em `VALIDACAO_PENDENTE.md` e `STATUS.md` §7.

## 11. Como auditar (roteiro para o avaliador)

1. **Schema**: revisar `supabase/migrations/` (numeração contínua, idempotente); conferir as
   RPCs `aplicar_ingestao_ccb`, `enriquecer_ccb_dados`, `aplicar_regras_decreto`,
   `uso_ingestao_empresa` e as políticas RLS por tabela.
2. **Isolamento**: autenticar como duas empresas distintas e confirmar que uma não vê os
   dados da outra (RLS no banco, não só na UI).
3. **Fluxo de IA**: enviar um PDF de CCB/decreto e verificar que (a) nada é gravado antes da
   aprovação, (b) a tentativa é logada com custo, (c) divergências travam a aprovação sem
   justificativa.
4. **Cota**: definir limite baixo num plano de teste e confirmar o **402** na leitura seguinte.
5. **Storage**: confirmar bucket privado e que o PDF só abre por URL assinada.
6. **Trilha**: conferir `auditoria` e os logs após aprovar/rejeitar.
7. **Segredos**: confirmar ausência de chaves no repositório (`git grep`) e presença apenas
   nos secrets do Base44/Supabase.
