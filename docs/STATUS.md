# CONSIGTEC — Status de Implementação (régua do roadmap)

> Linha de base atualizada em **2026-07-16**. Fonte da verdade: git (`main`); o
> Base44 sincroniza pelo git; migrações em `supabase/migrations/` (aplicadas no
> Supabase). Migrações no repo: **0001–0098**. Versão do app: **v1.46.0**.

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
| 4 | Margem & Averbação | ✅ | conector eConsig/Zetra ⚠️ (plano: Item 8) |
| 5 | Formalização, Antifraude & CCB | ✅ | assinatura eletrônica real ⚠️ |
| 6 | Recebíveis PMT & Conciliação | ✅ | — |
| 7 | Comissões (rateio) | ✅ | — |
| 8 | Cessão, Lastro & FIDC | ✅ | integração Kanastra/Utility ⚠️ |
| 9 | Pendências, SLA & Notificações | ✅ | SLA/escalonamento automático 🟡 |
| 10 | Dashboards executivo/investidor | ✅ | métricas reais + import histórico já entregues (0088) |
| 11 | Cobrança, Default & Renegociação | ✅ | — |
| 12 | Chamados & Inconsistências | ✅ | — |
| 13 | LGPD | ✅ | — |
| 14 | Carteiras Adquiridas | ✅ | — |
| 15 | Refinanciamento | ✅ | — |
| 16 | Integrações & Portais | ✅ | APIs reais (UY3/FIDC/WhatsApp) ⚠️ |

---

## 2) Épico SaaS multi-tenant + white-label (migr. 0052–0069) — ✅
Instância única (EmpresteiCard) → **plataforma multi-cliente**: `empresa_id` em tudo,
RLS tenant-aware, superadmin cross-tenant, planos de acesso, switcher "ver como",
onboarding de cliente, PixConsig por empresa, white-label (16 kits de cores + logo
clara/escura), menu lateral configurável por empresa, 1º login força troca de senha.

## 3) CRM (Estágio 2) — evoluído ✅ (migr. 0070)
Funil Kanban, painel de conversão, agenda com tarefas/follow-ups + lembrete diário.

## 4) Conciliação de folha — paridade BPO CONSIG (migr. 0071–0077) — ✅
Retorno, custos, averbadoras, expectativa, prévia (cartão), datas/notificação,
monitor, extração CSV, logs. ⚠️ Único externo: captura viva (RPA/API/FTP) nos portais.

## 4b) Ciclo de hardening — Itens 0–8 (migr. 0081–0088) — ✅
- **0081/0082** P0 segurança: log de acesso/impersonação (superadmin) + hardening de auditoria/branding.
- **0083** Decreto como dado: regras do convênio (idade, teto, prioridade, margem por produto) = motor de travas.
- **0084** CCB executividade (Lei 10.931): força executiva + checklist na aprovação.
- **0085** Conciliação: repasse perdido + status vivo por parcela.
- **0086** Motor de travas + relógio dos 30 dias (averbação/margem/idade/prazo/PMT).
- **0087** Cessão: deságio por lote, coobrigação, borderô, recompra.
- **0088** Métricas reais da carteira (VOP/VF/PDD/deságio) + importador histórico (CSV).
- **Item 8** (plano): conector de averbação eConsig/Zetra — `docs/CONSIGTEC_Item8_Conector_Averbacao_Plan.md`.

---

## 5) Leitura Automática de CCB — ✅ EM PRODUÇÃO (migr. 0078–0093)
Módulo em **Formalização ▸ Ingestão de CCB**. Chave `ANTHROPIC_API_KEY` configurada
e **validada ao vivo** (leitura real de CCB de 15 páginas). Princípio: **extração é
sugestão; nada grava sem conferência humana**.

**Fluxo e conferência**
- Upload do PDF → gate de **cota do plano** → armazenamento privado → **leitura por IA**
  (Claude, PDF nativo) → validações (PMT, CPF, valor×proposta, coerência) → conferência.
- Tela de conferência com **PDF lado a lado**, campos editáveis **agrupados por seção**,
  divergências destacadas, aprovar/rejeitar (justificativa em divergência crítica).
- UX de leitura: estado **"lendo com IA"** explícito, **barra de progresso**, polling
  (atualiza sozinha), **tentar novamente**, contraste tema claro/escuro.
- **Processamento em segundo plano (v1.37.0)** — o upload é dividido em 2 fases: a 1ª
  grava o documento (status `extraindo`) e **retorna na hora**; a 2ª dispara a extração
  por IA com `fetch keepalive`, que o servidor **conclui mesmo se a aba for fechada**.
  O operador **não precisa manter a tela aberta** — a lista/conferência atualiza por
  polling quando a leitura termina. Vale para **CCBs e decretos**.
- Idempotência por **hash SHA-256** (um PDF por empresa).

**Extração rica (0090)** — ~**45 campos** (antes 11): identificação, devedor (RG,
nascimento, estado civil, e-mail, telefone…), endereço completo, convênio/matrícula,
credor+CNPJ, correspondente, financeiro (CET, IOF, taxa a.a., liberado, vencimentos)
e dados bancários. Na aprovação, **persistidos** em `clientes`/`ccbs` + **jsonb integral**
em `ccbs.dados_extraidos`.

**Ajustes da leitura (0089)** — por empresa: escolha do **modelo** (Haiku/Sonnet/Opus),
**limite de confiança** (revisão obrigatória), **log de tentativas** (modelo, tokens,
**custo em R$**, confiança, duração) e **reprocessar** com outro modelo.

**Arquivamento (0091)** — Supabase Storage privado (criptografado, organizado por
**empresa/ano/mês**) como principal; **Google Drive por empresa** (pasta configurável +
conta de serviço) como espelho opcional. Cron de retry (0079).

**Cota/metering por plano (0092)** — limites de **leituras/mês**, **documentos** e
**armazenamento (MB)** no plano; o `ingerir_ccb` **bloqueia** ao exceder (superadmin e
empresa sem plano nunca bloqueiam). Card "Uso do plano" + banner + **editor de planos**
(superadmin). Custo por leitura medido e exibido em **R$** (câmbio único em `format.js`).

**Gestão da ingestão (0093)** — excluir tentativas do log, "limpar log", filtro por
status e **excluir ingestão** (removendo o PDF); CCB aprovada é protegida.

**Arquivo (CCBs)** — tela com banco completo das CCBs geradas, busca/filtros, download
do PDF, link do Drive e **log por CCB** (tentativas + auditoria).

**Componentes**: migr. `0078`, `0079`, `0080`, `0089–0093`; Edge Functions `ingerir_ccb`,
`aprovar_ingestao`, `espelhar_drive` (publicadas); front `IngestaoCCB.jsx`,
`AjustesLeituraCCB.jsx`, `ArquivoCCBs.jsx` + `api/ingestao.js`, `api/ingestaoConfig.js`,
`api/ccbsArquivo.js`.

### 5b) Leitura de DECRETOS/LEIS de convênios — ✅ construído + validado (migr. 0094 aplicada)

Mesma espinha da CCB aplicada ao **decreto que regula a consignação do ente**: upload do
PDF → `ingerir_decreto` (IA, tool `extrair_decreto`) extrai as regras (margem total/cartão,
prazo máx., adiantamento, recomposição, reposição ao erário, tipos permitidos,
consignatárias, lei base) → **conferência humana** que casa o decreto ao **convênio** →
`aprovar_decreto` aplica via RPC `aplicar_regras_decreto` nas colunas de regra do
`convenios` (0083 + novas de 0094) com proveniência (`decreto_numero/data`, `decreto_dados`
jsonb, `regras_origem='decreto'`). Reusa cota/metering, log de tentativas, Storage privado
(`empresa/decretos/ano/hash.pdf`) e o padrão de segurança/compliance da CCB.

**Comparação/validação (extraído × cadastrado)** — na conferência, cada regra é comparada
com o valor já cadastrado no convênio e classificada: **preenche** (cadastro vazio),
**confere** (igual) ou **DIVERGENTE** (conflito). Qualquer divergência **exige justificativa**
para aplicar (trava crítica, igual à CCB); recalcula ao vivo ao trocar de convênio/editar.
Badge indica se o convênio está **sem decreto (preenchendo)** ou **com decreto (validando)**.

**Arquivo de Decretos** — tela com banco dos decretos lidos, KPIs (lidos, aplicados,
convênios cobertos, armazenamento), busca e **detalhe** (regras agrupadas + jsonb + log de
leituras + PDF).

**Componentes**: migr. `0094` (**aplicada** e validada — 13/13 colunas, `convenio_id`, RPC
`aplicar_regras_decreto`); Edge Functions `ingerir_decreto`, `aprovar_decreto` (publicadas,
respondem 401); front `IngestaoDecreto.jsx` (aba **Decretos (IA)**), `ArquivoDecretos.jsx`
(aba **Arquivo de Decretos**) + `api/decretos.js`, `api/decretosArquivo.js`.
**Validação IA**: extração real do Decreto 4.572/2019 (Manaus) retornou todos os campos-alvo
corretos (margem 40%/10%, prazo 96m, adiantamento 20%, recomposição 48h, 1/3 erário) por
~R$ 0,02 em ~3s (Haiku). **Pendente do usuário**: **Publish** no Base44 (SQL 0094 já aplicado).

**Custo unitário real (medido nos logs da Anthropic, 15 pág.)**: Haiku ≈ **R$ 0,25**;
Sonnet ≈ **R$ 0,85**. CCBs curtas custam bem menos.

---

## 6) Suporte, Segurança & Compliance (páginas internas) — ✅
- **`/seguranca`** — documento técnico (14 seções): dados tratados + base legal,
  armazenamento/criptografia, perfis, subprocessadores, antifraude, LGPD, retenção,
  incidentes, glossário. Botão Imprimir/PDF. Marca CONSIGTEC.
- **`/suporte`** — central de suporte da leitura de CCB: como funciona, FAQ, solução
  de problemas, custos/cotas, contato.
- **Links**: rodapé de todas as telas + rodapé da **sidebar** + link na tela de Ingestão.
- Registro em `docs/CONSIGTEC_Seguranca_Compliance_Leitura_CCB.md`.

---

## 7) Pendências operacionais (publicação/dados/config)
1. **Publicar o frontend** no Base44 (telas de Ajustes/Arquivo/Suporte/Segurança, rodapé, cota).
2. *(Opcional)* `select backfill_tamanho_ccb();` — preenche o tamanho dos PDFs antigos (novos já gravam).
3. **Testar a cota**: definir um limite baixo num plano e confirmar o bloqueio na 2ª leitura.
4. **Semear dashboards** com a carteira histórica real (importador pronto — 0088).
5. **Integrações reais** (UY3/CNAB, Kanastra/Utility FIDC, WhatsApp) + **RPA/conector** das averbadoras.
6. **SLA/escalonamento automático** (Est. 9).
7. **Segurança Supabase (P0)** — ✅ tratado no plano atual: signups **FECHADOS**
   (`disable_signup=true`, 0 órfãos), **confirmação de e-mail** ON, **tamanho mínimo +
   complexidade** de senha e **rate limit** ativos (2026-07-16). ⚠️ **Proteção de senha vazada
   (HaveIBeenPwned) é recurso do plano Pro** — indisponível no Free. Mitigação atual: política
   de senha forte + signup fechado + poucos usuários internos. Opções: (a) ligar ao migrar
   para Pro; (b) *compensating control* próprio no fluxo de senha via API pública k-anonymity
   do HIBP (sem chave). **Decisão (2026-07-16): aceitar a postura atual para o MVP interno;
   revisitar (Pro ou HIBP próprio) antes do 1º cliente externo.**

## 8) Dependências externas
- **Anthropic API key** — ✅ **configurada e em uso** (leitura de CCB **e de decretos**).
- **Resend API key** — em uso (e-mail/lembretes).
- **PixConsig** x-api-key por cliente.
- **UY3 / Kanastra / Utility / WhatsApp** — handoff manual hoje; API depois.
- **Acessos aos portais das averbadoras** — para o conector (RPA/API/FTP).
- **Google Drive** (service account) — só para o espelho da CCB (opcional).

## 9) Decisões arquiteturais firmadas
- Supabase Auth + RLS multi-empresa · Secrets no Base44 (service_role só no backend) ·
  PixConsig = fonte da verdade dos convênios · empresa = tenant e unidade operacional ·
  **ingestão de documentos (CCB e decretos) com aprovação humana obrigatória** · **cota do
  plano bloqueia** a leitura ao exceder (superadmin/sem-plano nunca bloqueiam) · decreto
  aplicado ao convênio com **comparação preenche/confere/DIVERGENTE** e justificativa em
  conflito · custo da IA guardado em US$ (bruto) e exibido em R$ · superadmin nunca é
  bloqueado pela RLS.

## 10) Histórico recente
- **2026-07-17** — **v1.46.0** · **Conferência da CCB pelo CRONOGRAMA (datas + soma que fecha)**:
  a validação da parcela deixou de depender do recálculo teórico pela Tabela Price (que dava
  **falso positivo crítico** em cartão consignado / IOF-TAC financiado) e passou a usar o
  **cronograma extraído da própria CCB** como fonte da verdade: confere **nº de parcelas ×
  prazo** e, sobretudo, se a **soma das parcelas fecha com o valor total** (avisos, não
  travam a aprovação). O `1º/último vencimento` são derivados do cronograma quando não
  vierem nos campos. O recálculo Price virou **fallback como aviso** apenas quando a CCB
  não tem cronograma. Mudança só na edge function `ingerir_ccb` (auto-deploy) — vale para
  novas leituras e reprocessamentos; o front já exibe datas `DD/MM/AAAA` e valores em R$.
- **2026-07-17** — **v1.45.0** · **Máscaras nos campos extraídos (conferência de CCB)**:
  os campos da conferência agora exibem **formatação brasileira** — CPF `000.000.000-00`,
  CNPJ `00.000.000/0000-00` (credor/correspondente/endosso), CEP `00000-000`, telefone
  `(00) 00000-0000` e datas `DD/MM/AAAA` (emissão, nascimento, 1º/último vencimento). Os
  campos de **valor** (principal, liberado, total, IOF, tarifa, PMT) exibem **R$** e são
  digitados em centavos (armazenam número). O cronograma mostra os vencimentos em
  `DD/MM/AAAA` e os valores em **R$**. Padrão **exibir formatado /
  armazenar limpo** (`src/lib/masks.js`): grava dígitos puros (CPF/CNPJ/CEP/telefone) e
  datas em ISO, normalizando na carga para a aprovação ficar consistente mesmo nos campos
  não editados.
- **2026-07-17** — **v1.44.0** · **Padrões de CCB + leitura por páginas + endosso/cronograma**:
  a leitura de CCB voltou ao fluxo **inline** (a tela aguarda — comprovado) e agora envia ao
  Claude **só as páginas úteis** (via `pdf-lib`), resolvendo o tempo em CCBs longas. As páginas
  vêm de um **Padrão de CCB** escolhido no upload (migr. **0098** `ccb_templates`, seed
  **UY3**=1,2,13,14,15); superadmin cria/edita padrões em *Ajustes da leitura de CCB*. Novos
  campos: **Endosso** (beneficiário/CNPJ/tipo) e **Cronograma de parcelas (PMT)**, exibidos na
  conferência. `max_tokens` 8192. (A tentativa de rodar a extração numa Edge Function do
  Supabase foi descartada — EarlyDrop no runtime; arquivo `extrair_ccb` fica no repo sem uso.)
- **2026-07-17** — **v1.41.0** · **Fix EarlyDrop na `extrair_ccb`**: os logs do Supabase
  mostraram `shutdown reason=EarlyDrop` — o isolate era morto logo após responder, então o
  `EdgeRuntime.waitUntil` (background) não conclía e a CCB ficava `extraindo`. A função
  passou a rodar a extração **síncrona** (conclui ANTES de responder); o cliente dispara a
  invoke **sem aguardar** (não trava a tela) e a conexão aberta mantém a função viva.
  **Requer re-deploy** da `extrair_ccb` no Supabase.
- **2026-07-17** — **v1.40.0** · **Extração de CCB movida para o Supabase** (fix definitivo
  do loop em `extraindo`): as functions do Base44 têm teto de ~30s por requisição e a
  leitura de CCB grande estourava esse limite. Agora o `ingerir_ccb` (Base44) apenas sobe o
  PDF e cria a ingestão `extraindo`; o cliente dispara a **Edge Function do Supabase
  `extrair_ccb`** (`supabase/functions/extrair_ccb/index.ts`), que roda a extração com
  limite bem maior + `EdgeRuntime.waitUntil` (background real) e grava o status. Requer
  **deploy manual** da function + secret `ANTHROPIC_API_KEY` no Supabase (ver
  `docs/DEPLOY_EXTRAIR_CCB.md`). Decreto segue no fluxo do Base44 (leitura rápida).
- **2026-07-17** — **v1.39.0** · **Fix da ingestão de CCB** (loop em `extraindo`): a leitura
  da CCB voltou a ser **inline**, porém agora em **streaming** — a function emite keepalive
  a cada 5s enquanto o Claude lê o PDF (~30-50s), evitando o corte da conexão ociosa pelo
  gateway (causa do trava em `extraindo`). Decreto segue em segundo plano. Também nesta
  leva: **conferência de CNPJ** da empresa habilitada (CCB e decreto), box **"Conferências
  da leitura"** + tooltip dos avisos na listagem, **convênio pesquisável** (ConvenioPicker)
  e painel **"Regras vigentes (decreto)"** no cadastro do convênio.
- **2026-07-16** — **v1.38.0** · **UX da ingestão + reflexo no convênio**: (1) **aviso de
  conclusão** — `useExtracaoWatcher` observa as leituras em segundo plano e dispara um
  toast clicável (“Abrir”) quando cada uma termina, **mesmo com o painel fechado / após
  enviar vários / recarregar**, além de um selo “N em leitura…” no topo (CCB e decreto);
  (2) **vínculo de convênio pesquisável** — novo `ConvenioPicker` (combobox cmdk) substitui
  o `<select>`, filtrando por digitação os ~1100 convênios, com a opção “criar novo”;
  (3) **reflexo visível no convênio** — `aplicar_regras_decreto` já grava todas as regras
  (margens, prazos, prioridade, tipos, consignatárias, decreto nº/data, lei base) via
  COALESCE; a tela **Convênios** agora mostra um chip “decreto” na lista e um painel
  **“Regras vigentes (aplicadas por decreto)”** na edição.
- **2026-07-16** — **v1.37.0** · **Ingestão em segundo plano** (CCB e decretos): o
  `ingerir_ccb`/`ingerir_decreto` passam a **retornar imediatamente** após gravar o
  documento (status `extraindo`); a extração por IA roda numa 2ª chamada com
  `keepalive`, que o servidor conclui **mesmo com a aba fechada** (runtime efêmero
  validado por diagnóstico: `waitUntil`/promessas soltas não sobrevivem, mas o handler
  conclui após o cliente desconectar). Novo `fireFn` no `fnClient` + `processar(id)` em
  `api/ingestao.js` e `api/decretos.js`. Diagnósticos temporários removidos + checkpoint.
- **2026-07-16** — **P0 segurança**: signups **confirmados fechados** (`disable_signup=true`,
  0 órfãos). **CI smoke ampliado** — além do render da Sidebar, novo teste importa **todos**
  os módulos de página/componente (134) e falha se algum não carregar; barra o merge
  (exige *Require status checks* na proteção de branch). Falta só ligar **proteção de senha
  vazada** no painel Auth.
- **2026-07-16** — **Fix logs_acesso** (migr. 0096–0097): a `logs_acesso` real tem
  `(usuario_id, acao, entidade, registro_id, ip)` — diferente do 0081 no repo. Corrigidos
  `get_documento_admin` (0096) e **`registrar_log_acesso`** (0097, reconciliação aditiva) para
  gravar nas colunas reais. Com isso a **trilha de impersonação "ver como"** volta a ser
  registrada (era o risco 🔴 do Briefing) e a página de Documentos abre normalmente.
- **2026-07-16** — **v1.36.0** · **Documentos de Superadmin** (migr. 0095): página
  confidencial `/admin/documentos` (roadmap + briefing) com **RLS só-superadmin** e
  **leitura auditada** em `logs_acesso`; link no menu lateral (seção superadmin). Política de
  manter docs (`docs/` + roadmap in-app) e **versão do app** sempre atualizados a cada feature.
- **2026-07-16** — **Ingestão de decretos** (migr. 0094): extração por IA das regras do
  decreto, comparação preenche/confere/DIVERGENTE contra o convênio, telas Decretos (IA) e
  Arquivo de Decretos. Extração real do Decreto de Manaus validada. Docs de projeto
  atualizados + novo `CONSIGTEC_Auditoria_Externa.md` (mapa para validação externa).
- **2026-07-16** — Leitura de CCB **em produção** (chave validada, extração real).
  Extração rica (45 campos, 0090), Ajustes da leitura (0089), Arquivamento (0091),
  Cota/metering + editor de planos (0092), Gestão da ingestão (0093), Arquivo (CCBs),
  custos em R$, páginas de **Suporte** e **Segurança & Compliance** com a marca.
- **2026-07-15** — Ciclo de hardening (Itens 0–8, migr. 0081–0088). Hotfix do login
  (ReferenceError `AREA_SUBITEMS` no Sidebar) + redes de segurança no boot da auth.
