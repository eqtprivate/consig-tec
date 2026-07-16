# CONSIGTEC — Roadmap v2 (enriquecido com a operação real do Grupo Raman)

Este documento **complementa e atualiza** o `CONSIGTEC_Roadmap_Implementacao.md` (v1). O v1 segue valendo para convenções, modelo de dados-base e os prompts do Estágio 0 e 1. Aqui incorporamos a realidade operacional revelada pelo mapeamento de operações (BPMN), pela visão executiva de 6 etapas e pelo institucional do Grupo Raman (junho/2026).

---

## 1. O que os novos documentos revelam

**O CONSIGTEC deixa de ser uma plataforma abstrata e passa a ter uma operação viva por trás:**
- Operação real já rodando: **1.928 contratos**, **R$ 9,06 mi de VOP**, **R$ 37,02 mi de valor futuro**, múltiplo **VF/VOP 4,09x**, ticket médio **R$ 4,7 mil**, prazo médio ponderado **56,5 meses**, PDD **0,04%–0,8%**, fluxo mensal contratado **~R$ 722 mil**.
- Produto central: **cartão benefício consignado** (margem apartada de **5% a 20%**), distinto do empréstimo consignado (margem principal até 30%) e do cartão de crédito consignado (até 5%).
- Ecossistema de empresas com papéis definidos e **trilhos financeiros terceirizados** (UY3, Kanastra, Utility, FIDC, securitizadora).
- Uma **camada de cessão/securitização** que o v1 mal tocava: os recebíveis próprios viram CCB (UY3) e são **cedidos ao FIDC**, com CNAB444, termo de cessão, repasse e conciliação.

**Reposicionamento arquitetural (importante):** o CONSIGTEC é o **sistema de registro e orquestração** da operação. Ele não substitui a UY3, a Kanastra nem a Utility — ele governa convênios, CRM, tomadores, pipeline comercial, comissões, pendências, KPIs e **acompanha/concilia** a operação enquanto ela passa pelos trilhos externos. Onde a UY3/FIDC executam (anti-fraude, averbação, emissão de CCB, CNAB, pagamento, cessão), o CONSIGTEC **registra e reconcilia** — no MVP por entrada manual/handoff, depois via API/webhooks.

---

## 2. Mapa do ecossistema Grupo Raman (o que o CONSIGTEC precisa modelar)

| Empresa | Papel na operação | Como aparece no CONSIGTEC |
|---|---|---|
| **Grupo Raman** | Holding — originação, estruturação e distribuição de crédito | Nível topo da hierarquia (`Empresas`) |
| **Emprestei Card** (CNPJ 50.422.605/0001-49) | Originação e estruturação do cartão benefício; administra convênios e arquivo/remessa | Empresa originadora; dona da esteira de convênios |
| **PixConsig** (FIDC Pix Card Consig; TWIN FUND) | Capilarização via **modelo de franquias**; entrada em novos municípios | Rede de `Franquias`/`Parceiros` que originam |
| **EQT Private** (EQT Private Capital) | Interface com investidores, captação, wealth, gestão de contratos | Camada de investidores/relatórios (fase posterior) |
| **UY3 SCD** (CNPJ 39.587.424/0001-30) | SCD emissora das CCBs; anti-fraude, averbação, CNAB444, liberação de pagamento | Integração/execução — CONSIGTEC registra e concilia |
| **Kanastra** | Administradora fiduciária do FIDC | Camada FIDC — relatórios/conciliação |
| **Utility Credit** | Gestora do FIDC (carteira, alocação, risco) | Camada FIDC — relatórios/conciliação |
| **UC Securitizadora** | Debêntures de securitização (1,8% a.m., 24m) ao investidor | Camada de securitização/investidor |

**Consequência no modelo de tenancy:** a hierarquia não é só "parceiro → líder → corban". É **Grupo → Empresa → Franquia/Unidade → Líder → Corban/Operador**, com RLS refletindo essa árvore desde o Estágio 0.

---

## 3. Fluxo operacional real → módulos do CONSIGTEC

Backbone executivo (6 etapas): **Comercial → Formalização → Análise → Liberação → Operação → Cessão FIDC**. Detalhando o BPMN por raia e mapeando ao sistema:

| Raia / passo real | Ação | Módulo CONSIGTEC |
|---|---|---|
| **Emprestei + Órgão Público** | Tem decreto/lei? → adequação → solicitação credenciamento → apresentação documentação → [Órgão: análise → aprovado → assinatura convênio] → credenciamento finalizado → roteiro operacional → formalização Gestora de Margem → formalização Corban → aprovação taxas/comissão/spread → parametrização regras (UY3) → liberação canal de venda | **Est. 1 — Convênios & Entidades** (+ parametrização de produto, taxa, comissão, spread, Gestora de Margem, habilitação de canal) |
| **Call Center / Corban** | Prospecção → interesse? → **margem consignável (apartada)** → simulação proposta → solicita proposta/saque → envia link WhatsApp para formalização | **Est. 2 — CRM/Vendas** + **Est. 4 — Margem** + simulação/proposta |
| **Cliente + UY3** | Selfie, prova de vida, docs, aceite termo → inclui proposta → **anti-fraude** → **averbação** → **emissão CCB** → link assinatura → cliente assina CCB | **Est. 5 — Formalização Digital, Anti-fraude & CCB** (execução UY3; CONSIGTEC registra) |
| **UY3 + Cliente** | Recebe solicitação pagamento → **gera CNAB444** → gera termo de cessão → libera pagamento → cliente recebe saque em conta | **Est. 6 — Recebíveis/PMT** (liberação, CNAB444) + início **Est. 8 — Cessão** |
| **Cessão Fundo + UY3 + Emprestei** | Assina termo de cessão → efetua crédito conta UY3 → integra backoffice Emprestei/UY3 → operação cedida → conciliação → baixas das parcelas → aceite financeiro cessão; [Fundo: repasse e baixas] | **Est. 8 — Cessão, Lastro & FIDC** + conciliação |
| **Órgão Público (folha)** | Processa folha → desconta folha → gera arquivo de desconto em folha → realiza repasse | **Est. 6 — Conciliação de repasse/folha**; gatilhos de **Est. 11 — Cobrança** em falha de repasse |

---

## 4. Produto central: Cartão Benefício Consignado

O sistema deve tratar o cartão benefício como produto de primeira classe (não um "produto genérico"):
- **Margem apartada** (5%–20%), separada da margem principal; percentual definido por lei/decreto/convênio/edital do ente.
- **Modelo rotativo** + **saque vinculado** ao cartão + clube de benefícios (telemedicina, farmácia, assistências, seguro, sorteios) — relevante para CRM e retenção.
- Dependências operacionais: norma autorizadora → edital/credenciamento → integração de averbação da folha → reserva de margem → CCB (UY3) → **cessão dos recebíveis ao FIDC**.
- Impacto no sistema: configuração de produto com tipo de margem, % apartada por convênio, regras de elegibilidade específicas do cartão benefício, e modelagem de PMT/saque compatível com rotativo.

---

## 5. Camada nova — Cessão, Lastro & FIDC (Estágio 8)

Esta é a maior adição em relação ao v1. **Distinção essencial:**
- **Cessão própria ao FIDC** (real, ao vivo): originação própria → CCB (UY3) → cedida ao FIDC Pix Card Consig. É core.
- **Aquisição de carteiras de terceiros** (v1, Fase 2): compra de carteiras externas. Continua no roadmap, porém depois.

O módulo de cessão deve controlar: termo de cessão, recebíveis cedidos, **lastro do FIDC**, arquivos **CNAB444** (remessa/retorno), **repasse** do órgão vs recebível, **conciliação e baixas**, **aceite financeiro da cessão**, **PDD** (0,04–0,8%), **recompra de inadimplência excedente**, e a camada de **securitização/debêntures** (UC Securitizadora, 1,8% a.m., 24m). Eventos de gatilho de cobrança incluem falha de repasse do órgão, glosa e divergência entre desconto em folha e PMT previsto.

---

## 5.1 — Integração com a PixConsig (credenciamento de convênios) [NOVO]

A PixConsig já possui sistema próprio que faz o credenciamento das prefeituras. Portanto o CONSIGTEC **não reconstrói a esteira de credenciamento** — ele **consome** os convênios/entidades da PixConsig via API e mantém apenas o que é seu (a camada comercial/operacional de originação).

Princípios de projeto:
- **Fonte da verdade = PixConsig** para o cadastro do ente, credenciamento, norma autorizadora, produtos autorizados, % de margem apartada, sistema de averbação e vigência.
- **Camada anticorrupção (ACL) + espelho local:** um adaptador mapeia o payload da PixConsig para um modelo interno limpo (`Convenios`/`EntidadesCadastro` como *read model*). O restante do sistema (CRM, margem, CCB, comissão, dashboards) referencia o espelho local, sem chamar a PixConsig a cada operação.
- **Sincronização:** preferir **webhooks** da PixConsig (novo convênio ativo, alteração de produto/margem, suspensão) + **pull agendado** (delta) como reconciliação. Se não houver webhooks, começar por pull agendado.
- **De-para de identidade:** guardar `pixconsig_convenio_id`/`pixconsig_entidade_id` como chaves externas; as FKs internas apontam para o espelho local.
- **Fronteira de propriedade (confirmada):** a PixConsig detém e **entrega via API** o cadastral/credenciamento, norma autorizadora, produtos autorizados, margem apartada, vigência, sistema de averbação, **CAPAG, comissão da prefeitura e spread**. O CONSIGTEC detém apenas o *overlay* de distribuição comercial — como a comissão/spread do convênio é **rateada** entre canal/franquia/líder/corban/operador — mais habilitação de canal, metas/campanhas e pendências/SLA de originação, sempre referenciando o convênio vindo da PixConsig.
- **Fallback sem API:** suportar import via planilha/CSV ou entrada manual no mesmo schema + chave externa, para que a virada para API seja transparente e não bloqueie o MVP.
- **Segurança:** credenciais da PixConsig como *secrets* do Base44 (nunca no repositório), com escopo mínimo (read-only se apenas consumimos).

Entidades do CONSIGTEC nessa camada: `Convenios` e `EntidadesCadastro` (read model, com `pixconsig_*_id`, `origem_dado`, `ultima_sincronizacao`, `status_sync`), `SincronizacoesConvenio` (log de eventos/pulls) e `OverlayComercialConvenio` (comissão/spread/habilitação — propriedade do CONSIGTEC).

**Reflexo no roadmap:** o Estágio 1 deixa de ser "construir esteira de convênios" e vira "integrar + overlay", o que **encurta e desrisca o MVP**. A integração deve ser feita como **padrão reutilizável de ACL** — o mesmo padrão servirá para a UY3 (CCB/pagamento) e para Kanastra/Utility (FIDC). **A API será desenvolvida em conjunto com a PixConsig** (ainda não existe): a proposta de contrato — endpoints, schema, webhooks, auth e fallback CSV — está em `CONSIGTEC_API_PixConsig_Contrato.md`. Enquanto a API não entra no ar, o MVP usa o espelho via CSV/manual com o mesmo schema, para virada transparente.

---

## 5.2 — Estrutura real da cessão (Termo WL3 FIDC / UY3) [NOVO]

Um termo de cessão real (UY3 → WL3 FIDC, jun/2026) confirma e detalha a camada de cessão e revela um ponto importante: **a operação é multi-fundo e multi-gestora**.

- **Cedente:** UY3 SCD (39.587.424/0001-30) — emissora das CCBs.
- **Cessionário/Fundo:** WL3 FIDC (51.226.491/0001-24); **Gestora:** Redwood Asset Management (10.405.423/0001-45); indícios de administração via Planner e operação via WL3.
- Isso **coexiste** com o outro fundo do ecossistema (FIDC Pix Card Consig — gestora Utility, adm. Kanastra). Logo, `Fundos`, `Gestoras` e `Administradoras` são entidades de primeira classe, e a **conciliação usa o relatório da gestora correspondente ao fundo** de cada cessão.
- **Cessão sem coobrigação / sem regresso:** a cedente não responde pelo pagamento; a cobrança é do cessionário. Afeta a modelagem de risco/PDD e a régua de cobrança (quem cobra depende de a quem o crédito foi cedido).
- **Estrutura do termo (campos reais):** cedente, cessionário + gestora, valor total da cessão, referência ao Contrato de Cessão (data), e a **lista de títulos** — cada um com `titulo` (número, que casa com o número da CCB), `emitente` (tomador), `cpf_cnpj`, `vencimento`, `valor`, `agio_desagio`. Mais **dados de depósito** do preço de aquisição (banco, agência, conta, CNPJ da cedente) e foro.
- **Assinatura eletrônica = Clicksign** (operada via UY3): número do documento, hashes SHA256 (original e PAdES) e log de assinaturas por papel (cedente, cessionário, testemunhas) com CPF, tipo de certificado (ICP-Brasil A1/A3 ou token e-mail), IP, data/hora e geolocalização, sob a MP 2.200-2. **Consequência:** a camada de assinatura já é o **Clicksign** — integramos/recebemos o log dele (via UY3), sem adicionar outro fornecedor de assinatura.

Entidades do Estágio 8 acrescidas: `Fundos`, `Gestoras`, `Administradoras`, `Cedentes`, `TermosCessao`, `ItensCessao` (título → CCB, valor, ágio, vencimento, emitente), `DadosDepositoCessao`, `AssinaturasCessao` (Clicksign: doc, hashes, signatários, papéis, certificados, IP, geo). O `ItensCessao.titulo` referencia `CCBs.numero`, ligando a cessão ao crédito de origem.

---

## 6. Modelo de dados — adições e mudanças sobre o v1

**Ecossistema/tenancy:** `Empresas` (Grupo/Emprestei/PixConsig/EQT), `Franquias`, `UnidadesFranquia`. (`Parceiros`, `LideresEquipe`, `Corbans` já existem — passam a pendurar nessa árvore.)

**Produto:** estender `ProdutosPorConvenio` com `tipo_margem` (apartada/principal/cartao), `percentual_margem_apartada`, `rotativo`, `saque_vinculado`, `norma_autorizadora`, `spread`.

**Formalização/Análise:** `FormalizacaoDigital` (selfie, prova de vida, aceite termo, status), `AnalisesAntiFraude`, `AssinaturasCCB`, `IntegracoesUY3` (eventos: inclui proposta, averbação, CCB, pagamento).

**Recebíveis/Folha:** `ArquivosCNAB` (remessa/retorno, layout 444), `RepassesFolha`, `ConciliacaoRepasse`, `DescontosFolha`.

**Cessão/FIDC:** `Fundos` (FIDC), `TermosCessao`, `CessoesRecebiveis`, `LastroFIDC`, `PDDCarteira`, `RecompraInadimplencia`, `Debentures`/`Securitizacao`, `AceitesFinanceirosCessao`.

**Investidores (EQT, fase posterior):** `Investidores`, `AportesResgates`, `RelatoriosInvestidor`.

---

## 7. Roadmap v2 por estágios

Fases-doc: **F1**=MVP · **F2**=Financeiro/Cessão · **F3**=Compliance/LGPD · **F4**=Integrações · **F5**=Portais. Motor: **B**=Base44 builder · **C**=código (Claude Code / função backend).

| # | Estágio | Entrega principal | Fase | Motor |
|---|---------|-------------------|------|-------|
| 0 | Fundação & Setup | App, auth, **ecossistema Grupo→Empresa→Franquia→Líder→Corban**, RLS, auditoria, LGPD-mín, pendências/SLA, motor Resend | F1 | B+C |
| 1 | **Integração de Convênios — PixConsig API** | PixConsig é a **fonte da verdade** do credenciamento; CONSIGTEC consome via API (camada anticorrupção + espelho local), com **overlay comercial** próprio (comissão/spread/habilitação de canal) e CAPAG quando aplicável. Fallback CSV/manual se a API não estiver pronta | F1 | C+B |
| 2 | CRM / Vendas | Leads, funil, call center, **franquias/corbans**, simulação, proposta/saque, campanhas, métricas | F1 | B |
| 3 | Tomadores & Vínculos | Servidor público, múltiplos vínculos, elegibilidade do cartão benefício | F1 | B |
| 4 | Margem & Averbação | Consulta **margem apartada**, reserva, protocolo, validação vínculo/prazo, **handoff UY3** | F1 | B+C |
| 5 | Formalização Digital, Anti-fraude & CCB | Selfie/prova de vida/aceite, anti-fraude, **emissão CCB (UY3)**, assinatura via link, liberação/pagamento | F1 | C+B |
| 6 | Recebíveis PMT & Conciliação | **Motor de PMT**, parcelas, **CNAB444/desconto em folha**, repasse, conciliação previsto×recebido | F1/F2 | C+B |
| 7 | Comissões | Regras por **franquia/líder/corban/produto/spread**, motor de cálculo, status, auditoria | F1 | C+B |
| 8 | **Cessão, Lastro & FIDC** | Termo de cessão, recebíveis cedidos, lastro, PDD, recompra, aceite financeiro, securitização/debêntures | F2 | C+B |
| 9 | Pendências, SLA & Notificações | Central + e-mails Resend data-driven (base no Est.0) | F1 | B |
| 10 | Dashboards executivo/investidor & Relatórios | KPIs reais (VOP, VF, VF/VOP, ticket, prazo médio, PDD, IOF, fluxo mensal, concentração) + exportáveis | F1 | B |
| 11 | Cobrança, Default & Renegociação | Gatilhos incl. **falha de repasse/folha**, esteira, acordos, KPIs | F2 | B+C |
| 12 | Chamados & Inconsistências | Central + pedidos de titular LGPD | F3 | B |
| 13 | LGPD completo | Retenção, incidentes, compartilhamentos, direitos do titular | F3 | B+C |
| 14 | Carteiras Adquiridas de terceiros | Importador, due diligence, precificação (distinto da cessão própria) | F2/F4 | C |
| 15 | Refinanciamento (célula interna) | Fila, elegibilidade, simulação, nova CCB, vínculo original↔nova | F2/F4 | C+B |
| 16 | Integrações & Portais | **UY3 API/webhooks**, assinatura/biometria, sistemas de averbação, Kanastra/Utility (FIDC), WhatsApp, BI; portais de franquia/corban/investidor | F4/F5 | C+B |

**MVP recomendado (agora grounded na operação real):** a espinha originação→CCB→cessão para cartão benefício, com **1–2 convênios reais** (ex.: Sumaré/SP e Alenquer/PA, os maiores por VOP), UY3/CNAB/assinatura como **handoff manual** no início, e o **dashboard executivo já semeado com os números reais da carteira** para valor imediato. Estágios: 0 → 1 → 3 → 4 → 5 (manual) → 6 → 7 → 8 (registro) → 9 → 10.

---

## 8. Dashboards executivo/investidor (specs concretas — Estágio 10)

O institucional já entrega o desenho dos painéis que a diretoria e os investidores querem. Cards: contratos únicos, VOP, VF, múltiplo VF/VOP, ticket médio, prazo médio ponderado, fluxo mensal de parcelas, IOF total, PDD. Gráficos: originação mensal (série), distribuição por UF, **concentração por ente/prefeitura (top 10, com alerta de risco — Top 5 = 68,5%, Top 10 = 92,7%)**, top convênios/produtos por VOP, distribuição por prazo, **curva estimada de recebíveis por ano** (2026→2034). Todos filtráveis por empresa, franquia, convênio, UF, produto, prazo e período; exportáveis.

Semear com a base apurada (13/08/2025–10/06/2026) faz o painel nascer útil e vira um ativo de captação para a EQT Private.

---

## 9. Deltas aos prompts do v1

- **Estágio 0:** o prompt do v1 muda para incluir a hierarquia `Empresas → Franquias → UnidadesFranquia → Líderes → Corbans/Operadores` e RLS baseada nessa árvore (franquia só vê a própria produção; empresa vê suas franquias; Grupo vê tudo).
- **Estágio 1:** parametrização precisa cobrir tipo de margem (apartada), % por convênio, spread, taxa, comissão por canal, norma autorizadora e Gestora de Margem.
- **Estágio 5:** vira "Formalização Digital, Anti-fraude & CCB" com os passos do BPMN e o ponto de integração/registro da UY3.
- **Novo Estágio 8 (Cessão/FIDC)** e enriquecimento do Estágio 10 (dashboards reais) — prompts detalhados serão gerados quando chegarmos neles.

---

## 10. Decisões pendentes para eu disparar o Estágio 0

1. **Arquitetura de dados:** ✅ **Supabase canônico** (sistema de registro) + **Base44** como camada de app/UI/workflow + **Claude Code** para lógica pesada (funções Postgres/Edge Functions). Detalhe em `CONSIGTEC_Arquitetura_Tecnica.md`. A confirmar: tratamento da camada operacional (Supabase canônico vs Base44-entities com sync) e a decisão de auth (Supabase Auth vs JWT do Base44).
2. **MVP:** começamos pela espinha do cartão benefício com 1–2 convênios reais e UY3 manual (recomendado), ou por outro recorte?
3. **Integrações internas:** ✅ **PixConsig definido** — API co-desenvolvida; CAPAG, comissão da prefeitura e spread vêm da API; MVP via espelho CSV (ver `CONSIGTEC_API_PixConsig_Contrato.md`). Falta definir **UY3/Kanastra/Utility** (API hoje ou handoff manual na fase 1?).
4. **Seed de dados:** posso usar os números reais da carteira (1.928 contratos etc.) para semear o dashboard do MVP?
5. **"Repositório de senhas/acessos":** secrets de runtime no Base44 (recomendado) ou cofre de time? Contas Base44/GitHub/Resend já existem?

---

## 11. Leitura de documentos por IA — módulo de Ingestão (EM PRODUÇÃO) [2026-07-16]

Entrou em produção um **módulo de ingestão de documentos com IA** (Claude via API Anthropic) que transforma PDFs em dados estruturados, conferidos por humano antes de virar registro. Nasceu para a **CCB** e agora é a base reutilizável para outros documentos (a seguir, **decretos**).

**O que já está no ar (CCB):**
- **Extração nativa de PDF** pela API Messages (bloco `document` + *tool use* `extrair_ccb`), sem OCR externo. Cerca de **45 campos** — identificação (nº CCB, datas, valores, taxas, CET, IOF, tarifas), devedor (nome, CPF, RG, órgão expedidor, estado civil, endereço completo), convênio/averbação, credor/correspondente e dados bancários de crédito.
- **Conferência humana obrigatória:** a IA propõe, um operador aprova/corrige. Divergências abaixo da confiança mínima caem para revisão. Ao aprovar, os campos preenchem `clientes`/`ccbs` (COALESCE preserva o que já existe) e o **JSON completo** fica em `ccbs.dados_extraidos` (jsonb) para auditoria/reprocesso.
- **Ajustes de leitura** (`/ajustes-leitura-ccb`): escolha de modelo (Haiku/Sonnet/Opus), confiança mínima, **log de tentativas** (tokens, custo em R$, duração, status), reprocessamento e limpeza de log.
- **Arquivamento organizado e criptografado:** PDFs no Storage privado do Supabase em `empresa/ano/mês/hash.pdf` (bucket `ccb-docs`, RLS por empresa, URLs assinadas temporárias); opção de espelhar numa **pasta do Drive** por empresa.
- **Cota por plano (metering):** cada pacote define teto de **leituras/mês**, **armazenamento (MB)** e **documentos**; o `ingerir_ccb` recusa (402) antes de gastar IA quando a empresa estoura o limite. Superadmin e empresa sem plano nunca bloqueiam. Editor de planos no admin; banner/cartão de uso na UI.
- **Gestão da ingestão:** filtros por status, exclusão de tentativas e de ingestões não aprovadas, tela **Arquivo (CCBs)** com KPIs, busca e detalhe (campos agrupados + jsonb + log).
- **Segurança & Compliance in-app:** páginas `/suporte` e `/seguranca` (documento de compliance da operação de leitura — dados tratados, subprocessadores, antifraude, retenção, direitos do titular), com links no rodapé, na sidebar e nas telas de ingestão.

**Migrações:** `0089` (config + log de tentativas), `0090` (colunas persistidas + jsonb + `enriquecer_ccb_dados`), `0091` (arquivamento/Drive), `0092` (cota por plano), `0093` (gestão da ingestão). Edge Functions: `ingerir_ccb`, `aprovar_ingestao`, `espelhar_drive`.

### 11.1 — Próxima expansão: Ingestão de DECRETOS/LEIS de convênios [PLANEJADO]

Mesma espinha da CCB, aplicada ao **decreto/lei que regula a consignação de cada ente (prefeitura/órgão)**. Objetivo: ler o decreto, extrair as **regras de parametrização** e sugeri-las para o convênio correspondente — com conferência humana antes de valer. Isso alimenta diretamente as colunas de regra dos `convenios` (migração 0083: `idade_minima`, `idade_maxima_fim`, `teto_parcelas`, `max_contratos_servidor`, `prioridade_desconto`, `margem_por_produto` jsonb, `regras_manuais`).

**Campos-alvo de extração** (validados contra o Decreto nº 4.572/2019 de Manaus/AM):

| Campo | Exemplo (Manaus) | Uso no sistema |
|---|---|---|
| `decreto_numero`, `decreto_data` | 4.572 · 10/09/2019 | Identificação/versão da norma |
| `ente_nome`, `uf`, `esfera` | Manaus · AM · municipal | Vínculo ao convênio/ente |
| `lei_base` | Lei 871/2005 (alt. 1.726/2013) | Rastreabilidade jurídica |
| `margem_total_pct` | 40% | Teto de comprometimento da margem |
| `margem_cartao_pct` | 10% (exclusivo cartão de crédito) | Margem apartada do cartão |
| `prazo_maximo_meses` | 96 | Teto de parcelas (`teto_parcelas`) |
| `limite_adiantamento_pct` | 20% | Regra de adiantamento de remuneração |
| `recomposicao_margem` | 48h após liquidação antecipada | Regra operacional de margem |
| `reposicao_erario` | 1/3 da remuneração | Regra de desconto/erário |
| `tipos_consignacao_permitidos` | financiamento casa, previdência/seguro/saúde, entidade de classe, pensão, empréstimo, crédito farmácia, **cartão de crédito**, entretenimento, adiantamento, seguros | Produtos autorizados no ente |
| `consignatarias_habilitadas` | lista do Art. 4 | Elegibilidade de consignatária |
| `prioridade_desconto` | ordem legal de prioridade | `prioridade_desconto` |
| `vigencia`, `revogacoes` | — | Controle de versão da norma |

**Arquitetura proposta (reuso do módulo CCB):** upload do decreto (PDF) → `ingerir_decreto` (Claude, *tool* `extrair_decreto`, extração nativa de PDF) → grava tentativa/log e jsonb bruto → **tela de conferência** que casa o decreto ao **convênio/ente** e mostra as regras sugeridas × valores atuais → operador aprova → `aplicar_regras_decreto` preenche as colunas de regra do `convenios` (COALESCE, com `regras_atualizadas_em`/origem) e guarda o decreto no Storage (`empresa/decretos/ente/…`). Mesma cota/metering, mesmo padrão de segurança/compliance.

> **Validação pendente com o usuário:** confirmar o conjunto de campos acima (e se há campos do decreto de Manaus/decretos futuros que faltam) antes de construir a migração e as Edge Functions do módulo de decretos.
