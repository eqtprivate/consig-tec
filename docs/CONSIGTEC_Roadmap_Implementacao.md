# CONSIGTEC — Roadmap de Implementação e Biblioteca de Prompts

Documento operacional para construir o CONSIGTEC em estágios, usando **Base44** (plataforma/host), **GitHub** (versionamento), **Resend** (e-mails transacionais) e **Claude Code** (lógica de código profunda). Ele complementa o escopo funcional final — aqui tratamos de *como* e *em que ordem* construir.

---

## 1. Considerações sobre o escopo (o que ajustar antes de codar)

**O que o documento acerta e deve ser preservado a todo custo:**
- Separação de entidades: `Lead ≠ Tomador ≠ Vínculo ≠ Proposta ≠ Averbação ≠ CCB ≠ Recebível`. É a decisão mais importante do projeto e está correta.
- Coleta de dado na origem ("durante o processo, não depois") + matriz de obrigatoriedade por etapa.
- Status padronizados por esteira e trilha de auditoria em toda mudança crítica.
- CCB e PMT como ativos rastreáveis (visão de gestora de ativos, não só originadora).

**Riscos reais e ajustes recomendados:**
1. **Escopo grande demais para um único MVP.** São ~36 seções, ~60 entidades e 12+ setores. Fatiar é obrigatório. O MVP real deve cobrir *uma esteira ponta a ponta* com 1 tipo de convênio e 1 produto, e adiar carteiras adquiridas, importador em lote, refinanciamento avançado e LGPD completa.
2. **Averbação depende de sistemas externos** (Zetra, Consignet, etc.). No MVP a averbação é um **registro manual** (operador insere protocolo/resultado). Integração via API fica para a fase de integrações.
3. **PMT e comissão são lógica financeira determinística** — não podem ser "geradas por IA de UI". Devem ser **funções de backend testáveis e idempotentes** (aqui entra o Claude Code).
4. **LGPD e segurança não são só Fase 3.** Logs de acesso, RLS por perfil, auditoria e campo de consentimento precisam nascer no MVP — retrofit de proteção de dados é caro e arriscado. Puxei o *mínimo de LGPD* para o Estágio 0.
5. **Isolamento de parceiros (multi-tenant leve).** Parceiro/Corban só vê o que é dele. Isso é RLS desde o dia 1, não um filtro de tela depois.

**Decisão de arquitetura — Base44 × Claude Code (importante):**
O Base44 é excelente para os ~80% do sistema que são CRUD + RLS + dashboards + esteiras. Para os ~20% de lógica pesada (cálculo de PMT, motor de comissões, motor de notificações Resend, importador com validações, precificação de carteira), escrevemos **código** — e é aí que o Claude Code opera sobre o repositório GitHub sincronizado com o Base44. Portanto:
- **Prompts "builder"** → Base44 (montam entidades, telas, RLS, fluxos).
- **Prompts "código"** → Claude Code / funções de backend do Base44 (lógica financeira e integrações).

**Segredos/acessos:** segredos de runtime (chave do Resend, chaves de integração) ficam em **secrets/env do Base44**, nunca no repositório. Para credenciais humanas compartilhadas do time, use um gerenciador dedicado (1Password/Bitwarden). *Confirme se "repositório de senhas/acessos" era isso ou algo diferente.*

---

## 2. Convenções do projeto

- **Nomenclatura de entidades:** manter os nomes do escopo (`EntidadesCadastro`, `Convenios`, `Tomadores`, `CCBs`, `RecebiveisPMT`...) para rastreabilidade com o documento.
- **Toda entidade crítica carrega:** `created_by`, `created_date`, `updated_date`, `responsavel_atual`, `status`, e dispara registro em `Auditoria`.
- **RLS declarativa** por perfil em todas as entidades desde a criação (owner-based para parceiros/corbans; role-based para áreas internas).
- **Status como enum controlado** por esteira (nada de texto livre em campo de status).
- **E-mails:** toda notificação passa por `RegrasNotificacao` (data-driven) → função de dispatch → Resend → registro em `Notificacoes`.
- **GitHub:** app conectado ao repositório; secrets fora do repo; PR/branch para mudanças de código profundo via Claude Code.

---

## 3. Modelo de dados por fase

**Estágio 0 — Núcleo:** `User` (nativo, estendido com perfil/setor), `OrganogramaSetores`, `ResponsaveisSetor`, `Auditoria`, `LogsAcesso`, `ConfiguracoesSistema`, `Pendencias`, `SLAEtapas`, `Notificacoes`, `RegrasNotificacao`, `ConsentimentosAutorizacoes`.

**Convênios:** `EntidadesCadastro`, `Convenios`, `ParceirosConvenio`, `ProdutosPorConvenio`, `ChecklistConvenio`, `ContatosConvenio`, `HistoricoConvenio`, `AnaliseCAPAGEntidade`.

**Parceiros/Comissão:** `Parceiros`, `LideresEquipe`, `HabilitacoesParceiro`, `RegrasComissao`, `Comissoes`.

**CRM/Vendas:** `Leads`, `AtividadesComerciais`, `Campanhas`, `Propostas`, `MotivosPerda`, `CanaisOrigem`, `MetasComerciais`, `BonificacoesResultado`, `IndicadoresOperador`.

**Tomadores:** `Tomadores`, `VinculosFuncionais`, `MatriculasTomador`, `InstituicoesVinculadas`, `DocumentosTomador`, `RegrasElegibilidadeTomador`, `PoliticasLiberacaoCredito`.

**Averbação:** `ConsultasMargem`, `AverbacoesOperacao`, `ProtocolosAverbacao`, `SistemasConsignacao`, `ValidacoesVinculoFuncional`.

**Formalização/Recebíveis:** `CCBs`, `Contratos`, `Assinaturas`, `Liberacoes`, `DocumentosOperacao`, `RecebiveisPMT`, `ParcelasRecebivel`, `ConciliacoesPMT`, `LotesRecebiveis`, `AjustesRecebiveis`.

**Cobrança:** `CobrancasRenegociacoes`, `EventosDefault`, `AcordosRenegociacao`.

**Chamados:** `Chamados`, `CategoriasChamado`.

**LGPD (completo):** `SolicitacoesTitulares`, `IncidentesSeguranca`, `CompartilhamentosDados`, `PoliticasRetencao`.

**Crédito/Carteiras:** `DocumentosCCB`, `HistoricoCCB`, `StatusCredito`, `PagamentosRecebivel`, `EventosRecebivel`, `CarteirasAdquiridas`, `ItensCarteiraAdquirida`, `AnaliseCarteiraRecebiveis`, `OriginadorasExternas`, `ContratosCessaoCarteira`, `Renegociacoes`, `RefinanciamentosCCB`, `SimulacoesRefinanciamento`, `VinculosCCBOriginalNovaCCB`.

---

## 4. Roadmap por estágios

Fases-doc: **F1**=MVP operacional · **F2**=Financeiro/Recebíveis · **F3**=Compliance/LGPD · **F4**=Integrações · **F5**=Portais.

| # | Estágio | Entrega principal | Fase-doc | Motor | Depende de |
|---|---------|-------------------|----------|-------|-----------|
| 0 | Fundação & Setup | App, auth, perfis/setores, RLS, auditoria, LGPD-mínima, pendências/SLA, motor Resend, repo GitHub | F1 | Builder + Código | — |
| 1 | Convênios & Entidades | Esteira de cadastro→convênio ativo, CAPAG, checklist, histórico, notificações | F1 | Builder | 0 |
| 2 | CRM / Vendas | Leads, funil, call center, Corbans, campanhas, motivos de perda, métricas | F1 | Builder | 0,1 |
| 3 | Tomadores & Vínculos | Base robusta, múltiplos vínculos/matrículas, elegibilidade | F1 | Builder | 0 |
| 4 | Margem & Averbação | Consulta, reserva, protocolo, validação de prazo/vínculo, bloqueio pré-CCB | F1 | Builder + Código | 3 |
| 5 | CCB & Recebíveis PMT | CCB, liberação, **motor de PMT**, status, parcelas | F1 | Código + Builder | 2,3,4 |
| 6 | Comissões | Regras parametrizáveis, **motor de cálculo**, status, auditoria | F1 | Código + Builder | 5 |
| 7 | Pendências, SLA & Notificações | Central + e-mails data-driven via Resend (base já no Est.0) | F1 | Builder | 0 |
| 8 | Dashboards, KPIs & Relatórios | Painel executivo + relatórios exportáveis | F1 | Builder | 1–7 |
| 9 | Cobrança & Renegociação | Default, gatilhos, esteira, acordos, KPIs | F2 | Builder + Código | 5 |
| 10 | Chamados & Inconsistências | Central de chamados + pedidos de titular LGPD | F3 | Builder | 0 |
| 11 | LGPD completo | Retenção, incidentes, compartilhamentos, direitos do titular | F3 | Builder + Código | 0,10 |
| 12 | Crédito, CCBs & Carteiras (registro) | CCB própria/externa, status de crédito, parcelas — Fase 1 do crédito | F2 | Builder + Código | 5 |
| 13 | Refinanciamento (célula interna) | Fila, elegibilidade, simulação, nova CCB, vínculo original↔nova | F2/F4 | Código + Builder | 5,12 |
| 14 | Carteiras Adquiridas (avançado) | Importador em lote, due diligence, precificação, VP/deságio | F4 | Código | 12 |
| 15 | Integrações & Portais | Assinatura, sistemas de consignação, WhatsApp, BI; portais de parceiro/Corban | F4/F5 | Código + Builder | 1–8 |

**Fatia de MVP mínima recomendada (para valor rápido):** Estágios 0 → 1 → 3 → 4 → 5 → 6 → 7 → 8 com **um convênio e um produto**, esteira ponta a ponta. Os demais entram depois sem retrabalho, porque o núcleo e a RLS já estão prontos.

---

## 5. Como usar os prompts

- **Prompt builder (Base44):** cole no builder do Base44 (ou eu disparo via a ferramenta de criação/edição). Um `create` no Estágio 0, `edit` nos demais.
- **Prompt código (Claude Code):** rode no repositório GitHub sincronizado, para funções de backend, cálculo financeiro e integrações. Sempre com testes.
- Regra de ouro: **um estágio por vez**, valida, faz checkpoint no Base44 e commit no GitHub, só então avança.

---

## 6. Estágio 0 — Fundação (PROMPT BUILDER, Base44 `create`)

> Crie a plataforma **CONSIGTEC — Gestão de Consignados**, um sistema empresarial de gestão do ciclo de crédito consignado. Neste primeiro estágio, construa apenas a **fundação**, sem módulos de negócio ainda.
>
> **Autenticação e perfis:** use o login nativo. Estenda o usuário com: setor, cargo, perfil de acesso e parceiro/líder vinculado (quando externo). Perfis: `admin_diretoria`, `gestor_convenios`, `parceiro_externo`, `lider_equipe`, `call_center`, `corban`, `averbacao`, `financeiro`, `juridico_compliance`, `backoffice`, `suporte`, `admin_sistema`.
>
> **Entidades a criar (com RLS):**
> - `OrganogramaSetores` (setor, função, líder, descrição).
> - `ResponsaveisSetor` (usuário, setor, papel, substituto, alçada).
> - `Auditoria` (registro afetado, entidade, ação, usuário, valor_antigo, valor_novo, data). Toda alteração crítica grava aqui.
> - `LogsAcesso` (usuário, ação, entidade, registro, ip, data) — acessos/exportações/visualizações sensíveis.
> - `Pendencias` (origem, registro vinculado, responsável, prioridade [baixa/média/alta/crítica], prazo_sla, status [aberta/em_andamento/aguardando_terceiro/vencida/resolvida/cancelada], histórico).
> - `SLAEtapas` (etapa, prazo padrão, regra de escalonamento).
> - `Notificacoes` (evento, destinatários, canal, assunto, corpo, status_envio, data).
> - `RegrasNotificacao` (evento gatilho, destinatários por perfil/setor, template, ativo).
> - `ConsentimentosAutorizacoes` (titular, tipo, versão do termo, canal, data, ip, documento).
> - `ConfiguracoesSistema` (chave, valor, descrição).
>
> **RLS:** internos veem conforme setor/perfil; `parceiro_externo` e `corban` só veem registros que criaram ou que lhes são atribuídos; `admin_diretoria`/`admin_sistema` veem tudo, mas alterações críticas são auditadas.
>
> **Telas:** (1) Dashboard-shell com navegação por setor; (2) Gestão de usuários, perfis e setores; (3) Central de Pendências com filtros por responsável/prioridade/status/SLA; (4) Tela de configurações e regras de notificação; (5) Visualizador de auditoria/logs. Layout corporativo, sóbrio, responsivo, PT-BR.
>
> Ainda **não** crie convênios, tomadores, CCB, comissões ou carteiras — apenas a fundação acima.

**Complemento código (Claude Code) do Estágio 0 — motor de notificações Resend:**

> No repositório do CONSIGTEC, implemente uma função de backend `dispatchNotificacao(evento, contexto)` que: (1) busca em `RegrasNotificacao` as regras ativas do `evento`; (2) resolve destinatários por perfil/setor/registro; (3) renderiza assunto e corpo a partir do template; (4) envia via **Resend** usando a chave em `RESEND_API_KEY` (secret/env, nunca no código); (5) grava o resultado em `Notificacoes` com `status_envio`. Torne o envio idempotente por (evento + registro + destinatário) para evitar duplicidade. Inclua testes cobrindo: regra inexistente, falha de envio e reenvio idempotente. Não faça hardcode de e-mails nem de domínio.

---

## 7. Estágio 1 — Convênios & Entidades (PROMPT BUILDER, Base44 `edit`)

> No CONSIGTEC, adicione o módulo **Convênios & Entidades**, respeitando a fundação e a RLS já existentes.
>
> **Entidades:** `EntidadesCadastro`, `Convenios`, `ParceirosConvenio`, `ProdutosPorConvenio`, `ChecklistConvenio`, `ContatosConvenio`, `HistoricoConvenio`, `AnaliseCAPAGEntidade`.
>
> **Esteira** com status: `cadastro_iniciado → verificacao_duplicidade → qualificacao_comercial → documentacao → analise_juridica → validacao_operacional → parametrizacao → liberado_producao` (mais `recusado`/`suspenso`). Cada avanço exige os campos mínimos da etapa e grava `HistoricoConvenio` + `Auditoria`.
>
> **Dados da entidade:** nome oficial, CNPJ, tipo, natureza jurídica, cidade/UF, endereço; parceiro responsável, líder, origem; contatos (institucional, jurídico, operacional, RH/folha, decisor); norma autorizadora (lei/decreto/portaria/termo); produtos, margem, taxa, prazo, limite, documentação exigida; sistema de consignação, forma de averbação, data de corte, SLA; status, etapa, responsável, prazo, pendências, risco.
>
> **Verificação de duplicidade** por CNPJ/nome/cidade ao iniciar cadastro → gera pendência e notifica backoffice.
>
> **CAPAG** (`AnaliseCAPAGEntidade`) quando a entidade for ente público: classificação, data da consulta, fonte, responsável, observações de risco, impacto comercial, status de aprovação, revisão periódica. Ausência de CAPAG quando aplicável **bloqueia liberação** ou exige aprovação por alçada com justificativa auditada.
>
> **Notificações** (via regras já existentes): nova entidade, possível duplicidade, documentação solicitada/enviada/recusada, análise jurídica, SLA vencido, convênio liberado para produção.
>
> **Telas:** lista/kanban de entidades por etapa; ficha da entidade com abas (dados, documentos/checklist, CAPAG, contatos, histórico, pendências); tela de parametrização do convênio.

---

## 8. Template para os demais estágios

> No CONSIGTEC, adicione o módulo **[NOME]**, respeitando a fundação, a RLS e as convenções existentes.
> **Entidades:** [lista do modelo de dados].
> **Esteira/estados:** [status controlados].
> **Campos obrigatórios por etapa:** [matriz].
> **Regras de bloqueio/alçada:** [regras].
> **Notificações:** [eventos → destinatários].
> **Auditoria:** [o que gera trilha].
> **Telas:** [listas, fichas, dashboards].
> **Lógica de código (se houver):** [função de backend + testes — via Claude Code].

Cada estágio: buildar → validar → checkpoint Base44 → commit GitHub → avançar.
