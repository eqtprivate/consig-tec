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
| 11 | Cobrança, Default & Renegociação | ⬜ | — |
| 12 | Chamados & Inconsistências | ⬜ | — |
| 13 | LGPD completo | ⬜ | — |
| 14 | Carteiras Adquiridas | ⬜ | — |
| 15 | Refinanciamento | ⬜ | — |
| 16 | Integrações & Portais | ⬜ | UY3, Kanastra/Utility, WhatsApp, BI, portais |

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

## Caminho (MVP do roadmap) — espinha completa ✅
`0 ✅ → 1 ✅ → 3 ✅ → 4 ✅ → 5 ✅ → 6 ✅ → 7 ✅ → 8 ✅ → 9 ✅ → 10 🟡 (dashboard real a semear)`

Migrações aplicadas: 0001–0013. Falta: Est. 2 (leads/campanhas), Est. 10 (KPIs reais VOP/VF/PDD semeados), Est. 11–16.
Segurança: escalonamento de privilégio corrigido (0008), desativação bane no Auth. Pendente no painel: desligar signups + proteção de senha vazada.
com 1–2 convênios reais (Sumaré/SP, Alenquer/PA) e dashboard semeado.

## Dependências externas (para destravar estágios)
- **Resend API key** → fechar Estágio 0 (motor de notificação).
- **PixConsig**: API co-desenvolvida (ainda não existe) → MVP via **espelho CSV/manual** com o mesmo schema.
- **UY3 / Kanastra / Utility**: fase 1 por handoff manual; API depois.
- **WhatsApp Business API**: envio de link de formalização (fase de integração).

## Decisões já tomadas
- Supabase Auth + RLS Postgres ✅ · Secrets no Base44 ✅ · PixConsig = fonte da verdade dos convênios ✅ · Rota A (evoluir módulos atuais em direção ao roadmap) ✅
