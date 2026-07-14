import React, { useEffect, useMemo, useState } from 'react';
import { oportunidadesApi, leadsApi, motivosPerdaApi } from '@/lib/api/crm';
import { brl } from '@/lib/format';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader, StatCard, Panel, EmptyState } from '@/components/kit';
import { TrendingUp, Loader2, Trophy, XCircle } from 'lucide-react';

const ETAPA = { qualificacao: 'Qualificação', simulacao: 'Simulação', proposta_enviada: 'Proposta enviada', em_formalizacao: 'Em formalização', ganha: 'Ganha', perdida: 'Perdida' };
const ETAPA_ORDER = ['qualificacao', 'simulacao', 'proposta_enviada', 'em_formalizacao', 'ganha'];
const ETAPA_DOT = { qualificacao: 'bg-slate-400', simulacao: 'bg-blue-400', proposta_enviada: 'bg-amber-400', em_formalizacao: 'bg-violet-400', ganha: 'bg-green-500' };
const PERIODOS = [{ v: '30', l: 'Últimos 30 dias' }, { v: '90', l: 'Últimos 90 dias' }, { v: '365', l: 'Últimos 12 meses' }, { v: 'tudo', l: 'Todo o período' }];
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);

export default function PainelConversao() {
  const [opps, setOpps] = useState([]);
  const [leads, setLeads] = useState([]);
  const [motivos, setMotivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('90');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [o, l, m] = await Promise.all([
        oportunidadesApi.list().catch(() => []),
        leadsApi.list().catch(() => []),
        motivosPerdaApi.list().catch(() => []),
      ]);
      setOpps(o); setLeads(l); setMotivos(m); setLoading(false);
    })();
  }, []);

  const motivoNome = useMemo(() => new Map(motivos.map((m) => [m.id, m.nome])), [motivos]);

  const dentro = (iso) => {
    if (periodo === 'tudo') return true;
    if (!iso) return false;
    return (Date.now() - new Date(iso).getTime()) / 86400000 <= Number(periodo);
  };

  const m = useMemo(() => {
    const oppP = opps.filter((o) => dentro(o.created_at));
    const leadsP = leads.filter((l) => dentro(l.created_at));
    const ganhas = oppP.filter((o) => o.etapa === 'ganha');
    const perdidas = oppP.filter((o) => o.etapa === 'perdida');
    const abertas = oppP.filter((o) => !['ganha', 'perdida'].includes(o.etapa));
    const valorGanho = ganhas.reduce((s, o) => s + Number(o.valor_estimado || 0), 0);
    const pipeline = abertas.reduce((s, o) => s + Number(o.valor_estimado || 0), 0);
    const ponderado = abertas.reduce((s, o) => s + Number(o.valor_estimado || 0) * (Number(o.probabilidade || 0) / 100), 0);
    const fechadas = ganhas.length + perdidas.length;
    const winRate = pct(ganhas.length, fechadas);

    // Ciclo médio de fechamento (dias) — usa updated_at como data de fechamento.
    const ciclos = ganhas.map((o) => (o.updated_at && o.created_at ? (new Date(o.updated_at) - new Date(o.created_at)) / 86400000 : null)).filter((x) => x != null && x >= 0);
    const cicloMedio = ciclos.length ? Math.round(ciclos.reduce((s, x) => s + x, 0) / ciclos.length) : null;

    // Distribuição por etapa (para o funil)
    const porEtapa = ETAPA_ORDER.map((et) => {
      const l = oppP.filter((o) => o.etapa === et);
      return { etapa: et, n: l.length, valor: l.reduce((s, o) => s + Number(o.valor_estimado || 0), 0) };
    });
    const maxN = Math.max(1, ...porEtapa.map((e) => e.n));

    // Motivos de perda
    const perdaPorMotivo = {};
    for (const o of perdidas) {
      const nome = (o.motivo_perda_id && motivoNome.get(o.motivo_perda_id)) || o.motivo_perda || 'Não informado';
      perdaPorMotivo[nome] = (perdaPorMotivo[nome] || 0) + 1;
    }
    const perdas = Object.entries(perdaPorMotivo).sort((a, b) => b[1] - a[1]);

    // Ranking de operadores
    const opMap = {};
    for (const o of oppP) {
      const nome = o.operador?.nome || '—';
      const r = opMap[nome] || (opMap[nome] = { nome, ganhas: 0, perdidas: 0, valor: 0 });
      if (o.etapa === 'ganha') { r.ganhas++; r.valor += Number(o.valor_estimado || 0); }
      else if (o.etapa === 'perdida') r.perdidas++;
    }
    const ranking = Object.values(opMap).sort((a, b) => b.valor - a.valor || b.ganhas - a.ganhas).slice(0, 8);

    return {
      total: oppP.length, ganhas: ganhas.length, valorGanho, pipeline, ponderado, winRate, cicloMedio,
      leadConv: pct(oppP.length, leadsP.length), leadsN: leadsP.length,
      porEtapa, maxN, perdas, ranking,
    };
  }, [opps, leads, periodo, motivoNome]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="bg-card rounded-xl border border-border p-8"><EmptyState icon={Loader2} title="Carregando…" /></div>;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={TrendingUp}
        title="Painel de conversão"
        subtitle="Desempenho do funil comercial"
        actions={(
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>{PERIODOS.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
          </Select>
        )}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <StatCard label="Oportunidades" value={m.total} hint={`${m.leadsN} leads`} />
        <StatCard label="Taxa de conversão" value={`${m.winRate}%`} hint="ganhas / fechadas" />
        <StatCard label="Ganhas" value={m.ganhas} hint={brl(m.valorGanho)} />
        <StatCard label="Pipeline aberto" value={brl(m.pipeline)} hint={`ponderado ${brl(m.ponderado)}`} />
        <StatCard label="Ciclo médio" value={m.cicloMedio != null ? `${m.cicloMedio}d` : '—'} hint="criação → ganha" />
        <StatCard label="Lead → Oport." value={`${m.leadConv}%`} hint="conversão de leads" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Funil por etapa */}
        <Panel title="Funil por etapa" subtitle="Distribuição atual das oportunidades">
          <div className="space-y-2.5">
            {m.porEtapa.map((e) => (
              <div key={e.etapa}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1.5 text-foreground"><span className={`w-2 h-2 rounded-full ${ETAPA_DOT[e.etapa]}`} />{ETAPA[e.etapa]}</span>
                  <span className="text-muted-foreground num">{e.n} · {brl(e.valor)}</span>
                </div>
                <div className="h-2.5 bg-muted rounded overflow-hidden">
                  <div className={`h-full rounded ${ETAPA_DOT[e.etapa]}`} style={{ width: `${pct(e.n, m.maxN)}%` }} />
                </div>
              </div>
            ))}
            {m.total === 0 && <p className="text-xs text-muted-foreground">Sem oportunidades no período.</p>}
          </div>
        </Panel>

        {/* Motivos de perda */}
        <Panel title="Motivos de perda" subtitle="Oportunidades perdidas no período">
          {m.perdas.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma perda registrada no período. 👏</p>
          ) : (
            <div className="space-y-2">
              {(() => { const tot = m.perdas.reduce((s, [, n]) => s + n, 0); return m.perdas.map(([nome, n]) => (
                <div key={nome}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-foreground flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5 text-red-500" />{nome}</span>
                    <span className="text-muted-foreground num">{n} · {pct(n, tot)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded overflow-hidden"><div className="h-full bg-red-400 rounded" style={{ width: `${pct(n, tot)}%` }} /></div>
                </div>
              )); })()}
            </div>
          )}
        </Panel>
      </div>

      {/* Ranking de operadores */}
      <Panel title="Ranking de operadores" subtitle="Por valor ganho no período" bodyClassName="overflow-x-auto">
        {m.ranking.length === 0 ? <p className="text-xs text-muted-foreground">Sem dados no período.</p> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                <th className="py-2 pr-3 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">Operador</th>
                <th className="py-2 pr-3 font-medium text-right">Ganhas</th>
                <th className="py-2 pr-3 font-medium text-right">Valor ganho</th>
                <th className="py-2 pr-0 font-medium text-right">Conversão</th>
              </tr>
            </thead>
            <tbody>
              {m.ranking.map((r, i) => (
                <tr key={r.nome} className="border-b border-border last:border-0">
                  <td className="py-2 pr-3 text-muted-foreground">{i === 0 ? <Trophy className="w-4 h-4 text-amber-500" /> : i + 1}</td>
                  <td className="py-2 pr-3 font-medium text-foreground">{r.nome}</td>
                  <td className="py-2 pr-3 text-right num">{r.ganhas}</td>
                  <td className="py-2 pr-3 text-right num font-medium text-green-700">{brl(r.valor)}</td>
                  <td className="py-2 pr-0 text-right num text-muted-foreground">{pct(r.ganhas, r.ganhas + r.perdidas)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
