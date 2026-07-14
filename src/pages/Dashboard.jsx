import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { areasApi } from '@/lib/api/areas';
import { pendenciasApi } from '@/lib/api/pendencias';
import { propostasApi } from '@/lib/api/propostas';
import { contratosApi } from '@/lib/api/contratos';
import { comissoesApi } from '@/lib/api/comissoes';
import { dashboardApi } from '@/lib/api/dashboard';
import CountUp from '@/components/CountUp';
import { PageHeader, Panel, StatCard, StatusBadge } from '@/components/kit';
import { brl, dataBR } from '@/lib/format';
import {
  AlertCircle, ArrowRight, FileText, FileCheck2,
  DollarSign, TrendingUp, Wallet,
} from 'lucide-react';

// Etapas da esteira (visão executiva do grupo)
const ESTEIRA = [
  { key: 'margem_elegivel', label: 'Margem elegível', fmt: 'brl', tone: 'text-foreground' },
  { key: 'margem_reservada', label: 'Reservada (propostas)', fmt: 'brl', tone: 'text-amber-600' },
  { key: 'margem_efetivada', label: 'Efetivada (averbada)', fmt: 'brl', tone: 'text-blue-600' },
  { key: 'vop', label: 'VOP (contratos)', fmt: 'brl', tone: 'text-green-700' },
  { key: 'saldo_devedor', label: 'Saldo devedor', fmt: 'brl', tone: 'text-foreground' },
  { key: 'saldo_atraso', label: 'Em atraso', fmt: 'brl', tone: 'text-red-600' },
  { key: 'comissoes_previstas', label: 'Comissões previstas', fmt: 'brl', tone: 'text-foreground' },
  { key: 'valor_cedido', label: 'Cedido (FIDC)', fmt: 'brl', tone: 'text-foreground' },
];

const AREA_ICONS = {
  convenios: '🏛️', crm: '💬', averbacao: '📋', formalizacao: '📝',
  financeiro: '💰', comissoes: '💸', cobranca: '📞', cessao_fidc: '🔄',
  juridico: '⚖️', suporte: '🛟', admin: '⚙️',
};

const PROPOSTA_LABEL = {
  rascunho: 'Rascunho', em_analise: 'Em análise', aprovada: 'Aprovada',
  reprovada: 'Reprovada', cancelada: 'Cancelada',
};
const PROPOSTA_ORDER = ['rascunho', 'em_analise', 'aprovada', 'reprovada', 'cancelada'];
const STATUS_CHIP = {
  rascunho: 'bg-muted text-muted-foreground',
  em_analise: 'bg-amber-50 text-amber-700',
  aprovada: 'bg-green-50 text-green-700',
  reprovada: 'bg-red-50 text-red-700',
  cancelada: 'bg-muted text-muted-foreground/70',
};

export default function Dashboard() {
  const { perfil, isAdmin, availableAreas, activeUnidade, vinculos } = useAuth();
  const [allAreas, setAllAreas] = useState([]);
  const [pendencias, setPendencias] = useState([]);
  const [propostas, setPropostas] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [comissoes, setComissoes] = useState([]);
  const [exec, setExec] = useState(null);
  const [serie, setSerie] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const f = activeUnidade ? { franquia_id: activeUnidade.id } : {};
    setLoading(true);
    Promise.all([
      areasApi.list().catch(() => []),
      pendenciasApi.list(f).catch(() => []),
      propostasApi.list(f).catch(() => []),
      contratosApi.list(f).catch(() => []),
      comissoesApi.list(f).catch(() => []),
    ]).then(([a, p, pr, c, co]) => {
      setAllAreas(a);
      setPendencias(p);
      setPropostas(pr);
      setContratos(c);
      setComissoes(co);
      setLoading(false);
    });
  }, [activeUnidade]);

  useEffect(() => {
    if (!isAdmin) return;
    dashboardApi.executivo().then(setExec).catch(() => setExec(null));
    dashboardApi.evolucaoMensal(6).then(setSerie).catch(() => setSerie([]));
    dashboardApi.rankingConvenios(8).then(setRanking).catch(() => setRanking([]));
  }, [isAdmin]);

  const visibleAreas = allAreas.filter((a) =>
    isAdmin || availableAreas.some((va) => va.codigo === a.codigo)
  );

  if (!vinculos || vinculos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-amber-600" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2">Sem vínculos cadastrados</h2>
        <p className="text-sm text-muted-foreground">
          Seu usuário ainda não possui vínculos com unidades. Solicite ao administrador que cadastre seus vínculos para acessar o sistema.
        </p>
      </div>
    );
  }

  // KPIs
  const pendenciasAbertas = pendencias.filter((p) => p.status === 'aberta' || p.status === 'em_andamento');
  const pendenciasCriticas = pendencias.filter((p) => p.prioridade === 'critica');

  const propostasEmAnalise = propostas.filter((p) => p.status === 'em_analise');
  const contratosAtivos = contratos.filter((c) => c.status === 'ativo');
  const volumeFinanciado = contratosAtivos.reduce((s, c) => s + Number(c.valor_principal || 0), 0);

  const comissoesPrevistas = comissoes.filter((c) => c.status === 'prevista');
  const comissoesPagas = comissoes.filter((c) => c.status === 'paga');
  const totalComissaoPrevista = comissoesPrevistas.reduce((s, c) => s + Number(c.valor || 0), 0);
  const totalComissaoPaga = comissoesPagas.reduce((s, c) => s + Number(c.valor || 0), 0);

  // Funil de propostas
  const funil = PROPOSTA_ORDER.map((st) => ({
    status: st,
    count: propostas.filter((p) => p.status === st).length,
  }));
  const funilMax = Math.max(1, ...funil.map((f) => f.count));
  const decididas = propostas.filter((p) => p.status === 'aprovada' || p.status === 'reprovada').length;
  const aprovadas = propostas.filter((p) => p.status === 'aprovada').length;
  const conversao = decididas > 0 ? Math.round((aprovadas / decididas) * 100) : null;

  const ultimasPropostas = propostas.slice(0, 5);

  // Indicadores da carteira (Estágio 10)
  const vop = contratos.reduce((s, c) => s + Number(c.valor_principal || 0), 0);
  const vf = contratos.reduce((s, c) => s + Number(c.valor_total || c.valor_principal || 0), 0);
  const multiplo = vop > 0 ? (vf / vop) : null;
  const ticket = contratos.length ? vop / contratos.length : 0;
  const somaPrincipal = contratos.reduce((s, c) => s + Number(c.valor_principal || 0), 0);
  const prazoMedio = somaPrincipal > 0
    ? contratos.reduce((s, c) => s + Number(c.prazo || 0) * Number(c.valor_principal || 0), 0) / somaPrincipal
    : 0;
  // Concentração por convênio (top 5 por VOP)
  const porConvenio = Object.values(contratos.reduce((acc, c) => {
    const nome = c.convenio?.nome || 'Sem convênio';
    acc[nome] = acc[nome] || { nome, valor: 0 };
    acc[nome].valor += Number(c.valor_principal || 0);
    return acc;
  }, {})).sort((a, b) => b.valor - a.valor);
  const topConvenios = porConvenio.slice(0, 5);
  const concMax = Math.max(1, ...topConvenios.map((x) => x.valor));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Olá, ${perfil?.nome?.split(' ')[0] || 'usuário'}`}
        subtitle={`${activeUnidade ? activeUnidade.nome : 'Selecione uma unidade'} • Visão geral da operação`}
      />

      {/* Esteira consolidada (visão executiva do grupo) */}
      {isAdmin && exec && (
        <Panel>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Esteira consolidada <span className="text-xs font-normal text-muted-foreground">(grupo)</span></h2>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{Number(exec.contratos_ativos || 0)} contratos ativos</span>
              <span className={Number(exec.contratos_inadimplentes) ? 'text-red-600' : ''}>{Number(exec.contratos_inadimplentes || 0)} inadimplentes</span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
            {ESTEIRA.map((e, i) => (
              <div key={e.key} className="relative">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{e.label}</p>
                <p className={`text-lg font-bold num mt-0.5 ${e.tone}`}><CountUp value={Number(exec[e.key] || 0)} format={brl} /></p>
                {i < ESTEIRA.length - 1 && <ArrowRight className="hidden lg:block w-3.5 h-3.5 text-muted-foreground/40 absolute -right-2.5 top-6" />}
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>Tomadores elegíveis: <b className="text-foreground">{Number(exec.tomadores_elegiveis || 0)}</b></span>
            <span>Margem prioritária: <b className="text-foreground">{brl(Number(exec.margem_prioritaria || 0))}</b></span>
            <span>Cobranças abertas: <b className={Number(exec.cobrancas_abertas) ? 'text-red-600' : 'text-foreground'}>{Number(exec.cobrancas_abertas || 0)}</b> ({brl(Number(exec.valor_cobrancas || 0))})</span>
            <span>Comissões pagas: <b className="text-foreground">{brl(Number(exec.comissoes_pagas || 0))}</b></span>
            <span>Termos de cessão: <b className="text-foreground">{Number(exec.termos_cessao || 0)}</b></span>
          </div>
        </Panel>
      )}

      {/* Evolução mensal + ranking de convênios (grupo) */}
      {isAdmin && (serie.length > 0 || ranking.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {serie.length > 0 && (() => {
            const maxVop = Math.max(1, ...serie.map((s) => Number(s.vop || 0)));
            return (
              <Panel className="lg:col-span-2">
                <h2 className="text-sm font-semibold text-foreground mb-4">Evolução mensal <span className="text-xs font-normal text-muted-foreground">— produção × inadimplência</span></h2>
                <div className="flex items-end gap-3 h-40">
                  {serie.map((s) => {
                    const vopS = Number(s.vop || 0);
                    const venc = Number(s.valor_vencido || 0);
                    const h = Math.round((vopS / maxVop) * 100);
                    const hv = vopS > 0 ? Math.round((venc / vopS) * 100) : 0;
                    return (
                      <div key={s.competencia} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                        <span className="text-[10px] text-muted-foreground num">{vopS >= 1000 ? `${Math.round(vopS / 1000)}k` : brl(vopS)}</span>
                        <div className="w-full bg-muted rounded-t relative flex items-end" style={{ height: `${Math.max(h, 3)}%` }}>
                          <div className="w-full bar-brand rounded-t" style={{ height: '100%' }} />
                          {hv > 0 && <div className="absolute bottom-0 w-full bg-red-400 rounded-t" style={{ height: `${hv}%` }} title={`Vencido: ${brl(venc)}`} />}
                        </div>
                        <span className="text-[10px] text-muted-foreground">{s.competencia?.slice(5)}/{s.competencia?.slice(2, 4)}</span>
                        <span className="text-[10px] text-muted-foreground/70">{Number(s.contratos || 0)} ct</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-4 mt-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bar-brand inline-block" /> Produção (VOP)</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" /> Vencido no mês</span>
                </div>
              </Panel>
            );
          })()}

          {ranking.length > 0 && (() => {
            const maxR = Math.max(1, ...ranking.map((r) => Number(r.vop || 0)));
            const PRIO = { alta: 'text-green-700', media: 'text-amber-600', baixa: 'text-muted-foreground', sem_prioridade: 'text-muted-foreground/60' };
            return (
              <Panel>
                <h2 className="text-sm font-semibold text-foreground mb-4">Ranking de convênios <span className="text-xs font-normal text-muted-foreground">(produção)</span></h2>
                <div className="space-y-2.5">
                  {ranking.map((r) => (
                    <div key={r.convenio_id}>
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="text-foreground truncate pr-2">{r.cidade || r.convenio} <span className={PRIO[r.prioridade_comercial] || 'text-muted-foreground/60'}>•</span></span>
                        <span className="text-muted-foreground num shrink-0">{brl(r.vop)}</span>
                      </div>
                      <div className="h-2 bg-muted rounded overflow-hidden">
                        <div className="h-full bar-brand rounded" style={{ width: `${(Number(r.vop) / maxR) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            );
          })()}
        </div>
      )}

      {/* KPIs de crédito */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Propostas em análise" tone="amber" icon={FileText}
          value={loading ? '—' : <CountUp value={propostasEmAnalise.length} />}
          hint={loading ? '' : `${propostas.length} propostas no total`}
        />
        <StatCard
          label="Contratos ativos" tone="green" icon={FileCheck2}
          value={loading ? '—' : <CountUp value={contratosAtivos.length} />}
          hint={loading ? '' : `${contratos.length} contratos registrados`}
        />
        <StatCard
          label="Volume financiado" tone="primary" icon={DollarSign}
          value={loading ? '—' : <CountUp value={volumeFinanciado} format={brl} />}
          hint="Principal dos contratos ativos"
        />
        <StatCard
          label="Comissões previstas" tone="blue" icon={Wallet}
          value={loading ? '—' : <CountUp value={totalComissaoPrevista} format={brl} />}
          hint={loading ? '' : `${brl(totalComissaoPaga)} já pagas`}
        />
      </div>

      {/* Indicadores da carteira (Estágio 10) */}
      {!loading && contratos.length > 0 && (
        <Panel>
          <h2 className="text-sm font-semibold text-foreground mb-4">Indicadores da carteira</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              ['VOP', brl(vop), 'Volume de operações'],
              ['VF', brl(vf), 'Valor futuro'],
              ['VF/VOP', multiplo != null ? `${multiplo.toFixed(2)}x` : '—', 'Múltiplo'],
              ['Ticket médio', brl(ticket), `${contratos.length} contratos`],
              ['Prazo médio', `${prazoMedio.toFixed(0)}m`, 'ponderado por VOP'],
            ].map(([label, valor, hint]) => (
              <div key={label}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
                <p className="text-xl font-bold text-foreground num mt-1">{valor}</p>
                <p className="text-[11px] text-muted-foreground">{hint}</p>
              </div>
            ))}
          </div>
          {topConvenios.length > 0 && (
            <div className="mt-5 pt-4 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Concentração por convênio (top 5)</p>
              <div className="space-y-2">
                {topConvenios.map((c) => (
                  <div key={c.nome} className="flex items-center gap-3">
                    <span className="w-40 text-xs text-muted-foreground truncate shrink-0">{c.nome}</span>
                    <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                      <div className="h-full bar-brand rounded" style={{ width: `${(c.valor / concMax) * 100}%` }} />
                    </div>
                    <span className="w-24 text-right text-xs font-medium text-foreground num">{brl(c.valor)}</span>
                    <span className="w-10 text-right text-[11px] text-muted-foreground">{vop > 0 ? `${Math.round((c.valor / vop) * 100)}%` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Funil de propostas */}
        <Panel className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Funil de propostas</h2>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="w-3.5 h-3.5" />
              Conversão {conversao == null ? '—' : `${conversao}%`}
            </div>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : propostas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma proposta registrada nesta unidade.</p>
          ) : (
            <div className="space-y-3">
              {funil.map((f) => (
                <div key={f.status} className="flex items-center gap-3">
                  <span className="w-24 text-xs text-muted-foreground shrink-0">{PROPOSTA_LABEL[f.status]}</span>
                  <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden">
                    <div
                      className="h-full bar-brand rounded-md transition-all"
                      style={{ width: `${(f.count / funilMax) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-sm font-semibold text-foreground num">{f.count}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Pendências */}
        <Panel className="flex flex-col" bodyClassName="">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Pendências</h2>
            <Link to="/pendencias" className="text-xs text-primary hover:underline">Ver todas</Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-2xl font-bold text-foreground num">{loading ? '—' : pendenciasAbertas.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Abertas</p>
            </div>
            <div className="rounded-lg bg-red-50 p-3">
              <p className="text-2xl font-bold text-red-600 num">{loading ? '—' : pendenciasCriticas.length}</p>
              <p className="text-xs text-red-600/80 mt-0.5">Críticas</p>
            </div>
          </div>
          <div className="mt-3 rounded-lg bg-muted p-3">
            <p className="text-2xl font-bold text-foreground num">{visibleAreas.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Áreas acessíveis</p>
          </div>
        </Panel>
      </div>

      {/* Últimas propostas */}
      {!loading && ultimasPropostas.length > 0 && (
        <Panel>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Últimas propostas</h2>
            <Link to="/area/crm" className="text-xs text-primary hover:underline">Abrir CRM</Link>
          </div>
          <div className="divide-y divide-border">
            {ultimasPropostas.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.cliente?.nome || 'Cliente'}</p>
                  <p className="text-xs text-muted-foreground">{p.convenio?.nome || '—'} • {dataBR(p.created_at)}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold text-foreground num">{brl(p.valor_solicitado)}</span>
                  <StatusBadge className={STATUS_CHIP[p.status] || 'bg-muted text-muted-foreground'}>
                    {PROPOSTA_LABEL[p.status] || p.status}
                  </StatusBadge>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Áreas do processo */}
      {visibleAreas.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">Áreas do processo</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleAreas.map((area) => (
              <Link
                key={area.id}
                to={`/area/${area.codigo}`}
                className="group bg-card rounded-xl border border-border shadow-sm p-4 hover:border-primary/40 hover-lift"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{AREA_ICONS[area.codigo] || '📁'}</span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{area.nome}</p>
                      <p className="text-xs text-muted-foreground">{area.descricao}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
