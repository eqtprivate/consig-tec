import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BookOpen, Printer, ShieldCheck, LifeBuoy, ArrowRight, ArrowDown } from 'lucide-react';

// Documentação interna do CONSIGTEC: o que cada módulo faz, como se interligam e o
// organograma da operação (a esteira ponta a ponta). Página estática, sem serviços
// externos. Fonte: docs/STATUS.md (régua do roadmap).

const B = ({ children }) => <b className="text-foreground/90 font-semibold">{children}</b>;

function Sec({ n, id, titulo, children }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-border pt-6">
      <div className="flex items-baseline gap-3 mb-3">
        <span className="font-mono text-sm font-bold text-primary">{n}</span>
        <h2 className="text-lg font-semibold text-foreground">{titulo}</h2>
      </div>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-3 max-w-4xl">{children}</div>
    </section>
  );
}

function Tab({ head, rows }) {
  return (
    <div className="overflow-x-auto border border-border rounded-lg my-2">
      <table className="w-full text-sm bg-card">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>{head.map((h) => <th key={h} className="text-left font-mono text-[10.5px] uppercase tracking-wide font-semibold px-3 py-2.5">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border align-top">
              {r.map((c, j) => <td key={j} className="px-3 py-2.5">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Caixa de etapa do organograma.
function Etapa({ titulo, sub, cor = 'primary' }) {
  const cores = {
    primary: 'border-primary/40 bg-primary/5',
    green: 'border-green-500/40 bg-green-500/5',
    amber: 'border-amber-500/40 bg-amber-500/5',
    blue: 'border-blue-500/40 bg-blue-500/5',
    slate: 'border-border bg-muted/40',
  };
  return (
    <div className={`rounded-lg border ${cores[cor]} px-3 py-2 min-w-[150px] text-center`}>
      <div className="text-xs font-semibold text-foreground">{titulo}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
const Seta = () => (
  <><ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 hidden md:block" /><ArrowDown className="w-4 h-4 text-muted-foreground shrink-0 md:hidden" /></>
);

// Card de módulo (o que faz / entra / sai / interage).
function Modulo({ area, nome, faz, entra, sai, interage }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-mono text-[10px] uppercase tracking-wide text-primary/80">{area}</span>
        <h3 className="text-sm font-semibold text-foreground">{nome}</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-2">{faz}</p>
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
        <div><dt className="uppercase tracking-wide text-muted-foreground/70">Entra</dt><dd className="text-foreground/80">{entra}</dd></div>
        <div><dt className="uppercase tracking-wide text-muted-foreground/70">Sai</dt><dd className="text-foreground/80">{sai}</dd></div>
        <div><dt className="uppercase tracking-wide text-muted-foreground/70">Interage com</dt><dd className="text-foreground/80">{interage}</dd></div>
      </dl>
    </div>
  );
}

const NAV = [
  ['visao', 'Visão geral'], ['organograma', 'Organograma da operação'], ['transversais', 'Camadas transversais'],
  ['modulos', 'Módulo a módulo'], ['fluxo', 'Fluxo de dados'], ['ia', 'Camada de IA'], ['glossario', 'Glossário'],
];

export default function Documentacao() {
  return (
    <div className="space-y-6 pb-16">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><BookOpen className="w-5 h-5 text-primary" /></div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Documentação da plataforma</h1>
            <p className="text-sm text-muted-foreground max-w-3xl">Como o CONSIGTEC funciona de ponta a ponta: o que cada módulo faz, como eles se interligam e o organograma da operação — da captação do lead à cessão do recebível.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/suporte"><Button size="sm" variant="outline" className="gap-2"><LifeBuoy className="w-4 h-4" /> Suporte</Button></Link>
          <Link to="/seguranca"><Button size="sm" variant="outline" className="gap-2"><ShieldCheck className="w-4 h-4" /> Segurança</Button></Link>
          <Button size="sm" variant="ghost" className="gap-2" onClick={() => window.print()}><Printer className="w-4 h-4" /> Imprimir</Button>
        </div>
      </div>

      {/* Índice */}
      <nav className="flex flex-wrap gap-2">
        {NAV.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="text-[11px] px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/40">{label}</a>
        ))}
      </nav>

      {/* 1. Visão geral */}
      <Sec n="1" id="visao" titulo="Visão geral">
        <p>O CONSIGTEC é um <B>core de crédito consignado multi-empresa</B>. Uma mesma plataforma atende vários clientes (correspondentes/promotoras), isolados por <B>empresa</B> (tenant). A operação é uma <B>esteira</B>: capta-se o público elegível, transforma-se em lead, formaliza-se o contrato (CCB), averba-se na folha, gera-se o recebível, concilia-se o pagamento e, quando desejado, cede-se a carteira a um FIDC.</p>
        <p>Três princípios atravessam tudo: <B>o decreto do ente é dado</B> (as regras da consignação viram travas do sistema), <B>a IA é sugestão</B> (leitura de CCB/decreto nunca grava sem conferência humana) e <B>isolamento por empresa</B> (RLS em cada tabela; superadmin transita entre empresas).</p>
      </Sec>

      {/* 2. Organograma da operação */}
      <Sec n="2" id="organograma" titulo="Organograma da operação (a esteira)">
        <p>O fluxo principal, da prospecção ao lastro:</p>
        <div className="rounded-lg border border-border bg-card p-4 overflow-x-auto">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <Etapa titulo="1. Captação" sub="Folha pública + decreto" cor="blue" /><Seta />
              <Etapa titulo="2. Convênio" sub="Regras do decreto" cor="blue" /><Seta />
              <Etapa titulo="3. Originação" sub="Leads + enriquecimento" cor="blue" /><Seta />
              <Etapa titulo="4. CRM / Venda" sub="Funil → proposta" cor="primary" /><Seta />
              <Etapa titulo="5. Formalização" sub="CCB + antifraude" cor="primary" />
            </div>
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <Etapa titulo="6. Averbação" sub="Margem na folha" cor="primary" /><Seta />
              <Etapa titulo="7. Recebíveis" sub="PMT / parcelas" cor="green" /><Seta />
              <Etapa titulo="8. Conciliação" sub="Repasse × folha" cor="green" /><Seta />
              <Etapa titulo="9. Cessão / FIDC" sub="Lastro + deságio" cor="green" /><Seta />
              <Etapa titulo="10. Cobrança" sub="Default / renegociação" cor="amber" />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">Transversais a todas as etapas: <B>Financeiro</B> (carteira), <B>Comissões</B> (rateio), <B>Dashboards</B>, <B>Pendências/SLA</B>, <B>Jurídico/LGPD</B>, <B>Suporte</B> e <B>Admin</B> (acessos, planos, white-label).</p>
        </div>
      </Sec>

      {/* 3. Camadas transversais */}
      <Sec n="3" id="transversais" titulo="Camadas transversais">
        <Tab
          head={['Camada', 'O que garante']}
          rows={[
            [<B>Multi-tenant + white-label</B>, 'empresa_id em tudo, RLS tenant-aware, superadmin cross-tenant, planos + cota, cores/logo e menu por empresa.'],
            [<B>IA (leitura de documentos)</B>, 'Leitura de CCB e de decreto por IA (Claude); extração é sugestão, conferência humana obrigatória.'],
            [<B>Motor de travas</B>, 'As regras do decreto (margem, idade, prazo, prioridade) viram validações automáticas na venda/averbação.'],
            [<B>Segurança & LGPD</B>, 'Auditoria, log de acesso/impersonação, base legal do tratamento, backup diário (7 dias).'],
            [<B>Financeiro / Comissões</B>, 'Consolidam recebíveis e rateios a partir dos contratos e da conciliação.'],
          ]}
        />
      </Sec>

      {/* 4. Módulo a módulo */}
      <Sec n="4" id="modulos" titulo="Módulo a módulo">
        <div className="grid gap-2">
          <Modulo area="Captação" nome="Originação de Leads" faz="Pós-cadastro do convênio, agrega N fontes (planilhas/links de bases públicas autorizadas), normaliza, deduplica (CPF→nome→matrícula→órgão/cidade) e gera/atualiza leads. Fontes de 'enriquecimento' completam contato de quem já existe (sob portão LGPD)." entra="Planilhas/links da folha; decreto" sai="Leads; dimensionamento da base; decreto roteado" interage="Convênios, CRM/Leads, Decretos IA, LGPD" />
          <Modulo area="Convênios" nome="Convênios & Produtos · Capacidade" faz="Cadastro do ente/consignante e seus produtos; guarda as regras (do decreto) que travam a operação. Capacidade dimensiona o mercado por município." entra="Decreto (regras); folha capturada" sai="Regras/limites; potencial por convênio" interage="Decretos IA, Averbação, CRM, Originação" />
          <Modulo area="CRM / Vendas" nome="Leads → Funil → Proposta" faz="Discagem, agenda, oportunidades, tomadores (Tomador360), propostas e campanhas. É onde o lead vira venda." entra="Leads (originação); mailing" sai="Proposta de crédito" interage="Originação, Formalização, Comissões" />
          <Modulo area="Formalização" nome="CCB, Antifraude & Ingestão" faz="Gera/valida a CCB (Lei 10.931 — força executiva), roda antifraude e faz a leitura automática de CCB por IA (conferência humana → grava cliente/CCB/parcelas)." entra="Proposta; PDF da CCB" sai="Contrato + cronograma de parcelas" interage="CRM, Averbação, Recebíveis, Motor de travas" />
          <Modulo area="Averbação" nome="Margem & Averbação" faz="Consulta e reserva de margem consignável na folha; reconciliação da margem. Depende de conector com a averbadora (eConsig/Zetra) para tempo real." entra="Contrato; regras do convênio" sai="Margem reservada/averbada" interage="Formalização, Convênios, Conciliação" />
          <Modulo area="Financeiro" nome="Recebíveis, Conciliação & Carteira" faz="Motor de PMT gera as parcelas; conciliação de folha compara o que a folha pagou com o esperado (repasse perdido, status vivo por parcela); carteira consolida a posição." entra="Contrato/parcelas; retorno da folha" sai="Recebíveis conciliados; carteira" interage="Formalização, Averbação, Cessão, Comissões" />
          <Modulo area="Comissões" nome="Rateio de comissões" faz="Calcula e rateia comissões por regra (produtor/loja/parceiro) sobre as vendas efetivadas." entra="Propostas/contratos" sai="Comissões a pagar" interage="CRM, Financeiro" />
          <Modulo area="Cessão & FIDC" nome="Cessão, Lastro & PDD" faz="Cede a carteira a fundos: termos de cessão, deságio por lote, coobrigação, borderô, recompra e PDD. Depende de integração com o administrador do fundo (ex.: Kanastra)." entra="Carteira/recebíveis" sai="Lastro cedido; borderô" interage="Financeiro, Dashboards" />
          <Modulo area="Cobrança" nome="Default & Renegociação" faz="Trata inadimplência, default e renegociação das parcelas não honradas pela folha." entra="Parcelas em atraso (conciliação)" sai="Acordos/renegociação" interage="Financeiro, Jurídico" />
          <Modulo area="Jurídico" nome="LGPD & Chamados" faz="Direitos do titular (LGPD), base legal do tratamento e chamados jurídicos." entra="Solicitações do titular" sai="Registros de conformidade" interage="Originação (enriquecimento), Admin" />
          <Modulo area="Admin" nome="Acessos, Planos & White-label" faz="Usuários, papéis/áreas (setores que limitam funcionalidades), planos + cota, personalização (cores/logo/menu) e onboarding de empresa." entra="Config da empresa" sai="Escopo de acesso e limites" interage="Todos os módulos" />
        </div>
      </Sec>

      {/* 5. Fluxo de dados */}
      <Sec n="5" id="fluxo" titulo="Fluxo de dados (quem alimenta quem)">
        <Tab
          head={['Origem', '→', 'Destino', 'O que passa']}
          rows={[
            ['Decretos IA', '→', 'Convênios', 'Regras (margem, prazo, idade, prioridade) = travas'],
            ['Originação de Leads', '→', 'CRM / Leads', 'Leads pré-qualificados + capacidade de margem'],
            ['Originação (fonte decreto)', '→', 'Decretos IA', 'PDF do decreto para leitura'],
            ['CRM (proposta)', '→', 'Formalização', 'Proposta a formalizar em CCB'],
            ['Ingestão de CCB', '→', 'Clientes / CCBs / Parcelas', 'Dados conferidos viram contrato + cronograma'],
            ['Formalização', '→', 'Averbação', 'Contrato para reservar/averbar margem'],
            ['Formalização', '→', 'Recebíveis', 'Cronograma de parcelas (PMT)'],
            ['Folha (retorno)', '→', 'Conciliação', 'Comparação pago × esperado; repasse perdido'],
            ['Conciliação', '→', 'Cobrança', 'Parcelas não honradas'],
            ['Carteira', '→', 'Cessão / FIDC', 'Recebíveis para lastro/cessão'],
            ['Contratos', '→', 'Comissões', 'Base para rateio'],
          ]}
        />
      </Sec>

      {/* 6. Camada de IA */}
      <Sec n="6" id="ia" titulo="Camada de IA (leitura de documentos)">
        <p>Dois leitores por IA, mesma espinha: <B>upload → leitura (Claude, PDF nativo) → validações → conferência humana → aplicação</B>. Nada grava sem conferência.</p>
        <Tab
          head={['Leitor', 'Lê', 'Aplica em', 'Trava principal']}
          rows={[
            [<B>Ingestão de CCB</B>, 'A cédula (dados do devedor, financeiro, endosso, cronograma completo)', 'clientes / ccbs / parcelas', 'Soma do cronograma tem que fechar; CNPJ habilitado'],
            [<B>Decretos (IA)</B>, 'O decreto/lei do ente (margens, prazo, adiantamento…)', 'Regras do convênio', 'Divergência com o cadastro exige justificativa'],
            [<B>Originação de Leads</B>, 'Planilhas/links de folha pública', 'Leads + dimensionamento', 'Enriquecimento só com base legal (LGPD)'],
          ]}
        />
        <p className="text-xs">Padrões (templates) de CCB definem quais páginas ler por emissor (ex.: UY3 = 1,2,13,14,15). Custo e confiança de cada leitura ficam registrados.</p>
      </Sec>

      {/* 7. Glossário */}
      <Sec n="7" id="glossario" titulo="Glossário rápido">
        <Tab
          head={['Termo', 'Significado']}
          rows={[
            [<B>CCB</B>, 'Cédula de Crédito Bancário — o contrato do empréstimo, com força executiva (Lei 10.931).'],
            [<B>Convênio</B>, 'O ente consignante (prefeitura, órgão) onde a margem é averbada.'],
            [<B>Averbação</B>, 'Reserva do desconto na folha do servidor.'],
            [<B>Margem consignável</B>, 'Percentual do salário que pode ser comprometido com consignado.'],
            [<B>PMT</B>, 'Valor da parcela (prestação) — Tabela Price.'],
            [<B>Conciliação de folha</B>, 'Bater o que a folha efetivamente descontou/pagou com o esperado.'],
            [<B>Cessão / FIDC</B>, 'Venda da carteira de recebíveis a um fundo, com deságio.'],
            [<B>Motor de travas</B>, 'Regras (do decreto) que bloqueiam operações fora do permitido.'],
            [<B>Tenant / empresa</B>, 'Cliente da plataforma; seus dados são isolados dos demais.'],
          ]}
        />
      </Sec>

      <p className="text-[11px] text-muted-foreground border-t border-border pt-4">CONSIGTEC — documentação interna. A régua detalhada de implementação vive em <span className="font-mono">docs/STATUS.md</span>.</p>
    </div>
  );
}
