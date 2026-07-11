# CONSIGTEC — Status de Implementação (placar × roadmap v2)

Placar de progresso do produto contra o `CONSIGTEC_Roadmap_v2_Enriquecido.md`.
Legenda: ✅ feito · 🟡 parcial/esqueleto · 🟠 divergente (precisa realinhar) · ⬜ não iniciado.

> Convenção de execução: git é a fonte da verdade; o Base44 sincroniza pelo
> git; migrações SQL ficam em `supabase/migrations/` e são aplicadas no
> Supabase (`blnslbrflspiflrwsuzh`).

## Fundação arquitetural — ✅ alinhada ao `CONSIGTEC_Arquitetura_Tecnica.md`
- Supabase (Postgres) como sistema de registro + **RLS multi-empresa** ✅
- **Supabase Auth (JWT)** como identidade ✅ (recomendação do doc)
- Base44 como camada de app consumindo o Supabase ✅
- Claude Code + GitHub para lógica/migrações; git↔Base44 2-way ✅
- Secrets de runtime no Base44 (service_role só no backend) ✅

## Progresso por estágio (roadmap v2)

| # | Estágio | Status | Falta para fechar |
|---|---------|--------|-------------------|
| 0 | Fundação & Setup | ✅ | Motor **Resend** ✅ (`dispatchNotificacao`); LGPD-mín/consentimentos em uso |
| 1 | **Convênios via PixConsig (ACL)** | ✅ | Espelho local + `pixconsig_*_id` + overlay + import CSV + cartão benefício (migr. 0005 aplicada) |
| 2 | CRM / Vendas | 🟡 | Tomadores+Propostas ✅; falta leads, funil visual, campanhas |
| 3 | Tomadores & Vínculos | ✅ | Matrículas múltiplas + margem apartada + elegibilidade (`matricula_elegivel_cartao`) |
| 4 | Margem & Averbação | ✅ | Reserva de margem (`reservar/liberar_margem_proposta`) + averbação via proposta + handoff UY3 (migr. 0007) |
| 5 | Formalização, Anti-fraude & CCB | ✅ | formalizacoes/analises_antifraude/ccbs + módulo abas (migr. 0009) |
| 6 | Recebíveis PMT & Conciliação | ✅ | Motor PMT (`calcular_pmt`/`simular_pmt`/`gerar_cronograma_contrato`) + repasses (migr. 0010) |
| 7 | Comissões | ✅ | Motor de rateio (`calcular_comissoes_contrato`) + regras_comissao (migr. 0011) |
| 8 | **Cessão, Lastro & FIDC** | ✅ | Fundos/Gestoras/Termos/Itens→CCB/PDD/Assinaturas multi-fundo (migr. 0012) |
| 9 | Pendências, SLA & Notificações | ✅ | Motor Resend `dispatchNotificacao` + fila (migr. 0013). Falta SLA/escalonamento automático |
| 10 | Dashboards executivo/investidor | 🟡 | KPIs de operação ✅ (funil/volume/comissões); falta VOP/VF/PDD/concentração semeados |
| 11 | Cobrança, Default & Renegociação | ✅ | cobrancas + gatilhos (falha repasse/inadimplência/glosa) (migr. 0015) |
| 12 | Chamados & Inconsistências | ✅ | chamados (chamado/inconsistência/lgpd) — área suporte (migr. 0015) |
| 13 | LGPD completo | ✅ | lgpd_solicitacoes (titular) + consentimentos; restrito a admin (migr. 0015) |
| 14 | Carteiras Adquiridas | ✅ | carteiras_adquiridas (due diligence/precificação) — admin/Expansão (migr. 0016) |
| 15 | Refinanciamento | ✅ | refinanciamentos (fila/simulação/nova CCB) — admin/Expansão (migr. 0016) |
| 16 | Integrações & Portais | ✅ | integracoes (painel de status UY3/FIDC/WhatsApp/Resend/PixConsig) (migr. 0016). Falta a implementação real de cada API/webhook |

## O que já existe hoje (entregue)
- **Estágio 0**: empresas (hierarquia), franquias, áreas, papéis, usuários, vínculos, pendências, auditoria, logs de acesso, configurações, consentimentos (tabela), sla_etapas (tabela).
- **Acessos/segurança**: roles (usuario/admin/superadmin), criação de usuário, senhas temporárias + troca obrigatória, reset, ativar/desativar (bloqueio no login), exclusão real, RLS por escopo.
- **Esqueleto Estágio 1–7 (CRUD)**: convênios, clientes, propostas, contratos, averbações, financeiro/parcelas, comissões — telas por área.

## Reposicionamentos do roadmap a absorver
1. **Convênios = integração PixConsig** (espelho + overlay), não CRUD caseiro.
2. **Cartão benefício** como produto de 1ª classe (margem apartada 5–20%, rotativo, saque vinculado).
3. **PMT e comissão** = Edge/backend functions testáveis (não lógica de tela).
4. **Cessão/FIDC** (Estágio 8) multi-fundo (WL3/Redwood + Pix Card Consig/Utility/Kanastra).
5. **Dashboards** com KPIs reais da carteira (1.928 contratos, VOP R$ 9,06 mi, VF R$ 37 mi, PDD, concentração).
6. **Nomenclatura** do escopo (`Tomadores`, `EntidadesCadastro`, `CCBs`, `RecebiveisPMT`) para rastreabilidade.

## Roadmap completo — todos os 17 estágios (0–16) implementados ✅
Espinha + fases F2/F3/F4/F5 no ar. Migrações **0001–0016**.

**O que resta é implementação/integração real, não estrutura:**
- Dashboard: semear a carteira histórica real (1.928 contratos) para KPIs de captação.
- Integrações (Est. 16): implementar de fato UY3 (CCB/CNAB/webhooks), Kanastra/Utility (FIDC), WhatsApp, PixConsig (quando a API existir) — hoje é registro/handoff manual + painel de status.
- SLA/escalonamento automático (Est. 9) e templates de e-mail data-driven.
- Segurança (painel Supabase): desligar signups + ativar proteção de senha vazada.

Dependências externas: RESEND_API_KEY (envio real), x-api-key PixConsig (sandbox), credenciais UY3/Kanastra.
com 1–2 convênios reais (Sumaré/SP, Alenquer/PA) e dashboard semeado.

## Dependências externas (para destravar estágios)
- **Resend API key** → fechar Estágio 0 (motor de notificação).
- **PixConsig**: API co-desenvolvida (ainda não existe) → MVP via **espelho CSV/manual** com o mesmo schema.
- **UY3 / Kanastra / Utility**: fase 1 por handoff manual; API depois.
- **WhatsApp Business API**: envio de link de formalização (fase de integração).

## Decisões já tomadas
- Supabase Auth + RLS Postgres ✅ · Secrets no Base44 ✅ · PixConsig = fonte da verdade dos convênios ✅ · Rota A (evoluir módulos atuais em direção ao roadmap) ✅
