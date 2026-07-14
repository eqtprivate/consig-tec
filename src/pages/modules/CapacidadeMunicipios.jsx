import React, { useEffect, useMemo, useState } from 'react';
import { capacidadeApi } from '@/lib/api/capacidade';
import { metasComerciaisApi } from '@/lib/api/crm';
import { brl, dataBR } from '@/lib/format';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatCard, StatusBadge, EmptyState } from '@/components/kit';
import { TrendingUp, Users, Wallet, Star, Search, X } from 'lucide-react';
import { useSortable, sortRows, SortTh, norm } from '@/lib/table';

const PRIO = {
  alta: { label: 'Alta', cls: 'bg-green-100 text-green-800', ord: 0 },
  media: { label: 'Média', cls: 'bg-amber-100 text-amber-800', ord: 1 },
  baixa: { label: 'Baixa', cls: 'bg-muted text-muted-foreground', ord: 2 },
  sem_prioridade: { label: 'Sem prioridade', cls: 'bg-muted text-muted-foreground', ord: 3 },
};
const compAtual = () => new Date().toISOString().slice(0, 7);

export default function CapacidadeMunicipios() {
  const [rows, setRows] = useState([]);
  const [metas, setMetas] = useState([]);
  const [realizado, setRealizado] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroPrio, setFiltroPrio] = useState('todas');
  const { sort, toggle } = useSortable('margem', 'desc');
  const comp = compAtual();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [cap, m, r] = await Promise.all([
        capacidadeApi.porConvenio().catch(() => []),
        metasComerciaisApi.list({ competencia: comp }).catch(() => []),
        metasComerciaisApi.realizado(comp).catch(() => []),
      ]);
      setRows(cap); setMetas(m); setRealizado(r); setLoading(false);
    })();
  }, [comp]);

  const metaDe = (id) => metas.find((x) => x.convenio_id === id) || null;
  const realDe = (id) => realizado.find((x) => x.convenio_id === id) || null;

  const view = useMemo(() => {
    const q = norm(busca.trim());
    let v = rows.filter((r) => {
      if (filtroPrio !== 'todas' && r.prioridade_comercial !== filtroPrio) return false;
      if (q) {
        const alvo = norm([r.cidade, r.nome, r.uf].filter(Boolean).join(' '));
        if (!alvo.includes(q)) return false;
      }
      return true;
    });
    return sortRows(v, sort, {
      municipio: (r) => r.cidade || r.nome,
      prioridade: (r) => PRIO[r.prioridade_comercial]?.ord ?? 9,
      tomadores: (r) => Number(r.tomadores || 0),
      vinculos: (r) => Number(r.vinculos_elegiveis || 0),
      margem: (r) => Number(r.margem_disponivel || 0),
      ticket: (r) => Number(r.ticket_medio_margem || 0),
    });
  }, [rows, filtroPrio, busca, sort]);
  const temFiltro = busca || filtroPrio !== 'todas';

  const totalMargem = rows.reduce((s, r) => s + Number(r.margem_disponivel || 0), 0);
  const totalTomadores = rows.reduce((s, r) => s + Number(r.tomadores || 0), 0);
  const prioritarios = rows.filter((r) => ['alta', 'media'].includes(r.prioridade_comercial));
  const margemPrioritaria = prioritarios.reduce((s, r) => s + Number(r.margem_disponivel || 0), 0);
  const maxMargem = Math.max(1, ...rows.map((r) => Number(r.margem_disponivel || 0)));

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">Capacidade de geração de vendas por município — margem apartada elegível disponível × prioridade comercial e metas de <b>{comp}</b>.</p>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Wallet} label="Margem elegível total" value={brl(totalMargem)} tone="green" />
        <StatCard icon={Star} label="Margem em prioritários" value={brl(margemPrioritaria)} hint={`${prioritarios.length} município(s) alta/média`} tone="amber" />
        <StatCard icon={Users} label="Tomadores elegíveis" value={String(totalTomadores)} tone="blue" />
        <StatCard icon={TrendingUp} label="Municípios com convênio" value={String(rows.length)} />
      </div>

      {/* Busca + filtros (a ordenação é pelos cabeçalhos) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar município, convênio ou UF…" className="pl-9" />
        </div>
        <div className="w-44">
          <Select value={filtroPrio} onValueChange={setFiltroPrio}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as prioridades</SelectItem>
              {Object.entries(PRIO).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {temFiltro && (
          <Button variant="ghost" size="sm" onClick={() => { setBusca(''); setFiltroPrio('todas'); }} className="gap-1 text-muted-foreground"><X className="w-3.5 h-3.5" /> Limpar</Button>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
        {loading ? (
          <EmptyState title="Carregando..." />
        ) : view.length === 0 ? (
          <EmptyState icon={Search} title="Nenhum convênio corresponde aos filtros." />
        ) : (
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <SortTh label="Município / Convênio" sortKey="municipio" sort={sort} onSort={toggle} />
                <SortTh label="Prioridade" sortKey="prioridade" sort={sort} onSort={toggle} />
                <SortTh label="Tomadores" sortKey="tomadores" sort={sort} onSort={toggle} align="right" />
                <SortTh label="Vínculos" sortKey="vinculos" sort={sort} onSort={toggle} align="right" />
                <SortTh label="Margem disponível" sortKey="margem" sort={sort} onSort={toggle} />
                <SortTh label="Ticket médio" sortKey="ticket" sort={sort} onSort={toggle} align="right" className="hidden lg:table-cell" />
                <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Meta × Realizado</th>
              </tr>
            </thead>
            <tbody>
              {view.map((r) => {
                const prio = PRIO[r.prioridade_comercial] || PRIO.sem_prioridade;
                const meta = metaDe(r.convenio_id);
                const real = realDe(r.convenio_id);
                const pct = Math.round((Number(r.margem_disponivel) / maxMargem) * 100);
                const metaV = meta?.meta_vendas || 0;
                const realV = Number(real?.vendas || 0);
                return (
                  <tr key={r.convenio_id} className="border-b border-border hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{r.cidade || r.nome}{r.uf ? `/${r.uf}` : ''}</p>
                      <p className="text-xs text-muted-foreground">{r.nome}{r.ativo ? '' : ' · inativo'}{r.base_atualizada_em ? ` · base ${dataBR(r.base_atualizada_em)}` : ''}</p>
                    </td>
                    <td className="px-4 py-3"><StatusBadge className={prio.cls}>{prio.label}</StatusBadge></td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{r.tomadores}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{r.vinculos_elegiveis}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground whitespace-nowrap">{brl(r.margem_disponivel)}</span>
                        <div className="flex-1 h-1.5 bg-muted rounded overflow-hidden min-w-[40px]">
                          <div className="h-full bar-brand rounded" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground hidden lg:table-cell">{brl(r.ticket_medio_margem)}</td>
                    <td className="px-4 py-3 text-right">
                      {metaV > 0 ? (
                        <span className={`text-sm font-medium ${realV >= metaV ? 'text-green-700' : 'text-muted-foreground'}`}>{realV}/{metaV}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{realV > 0 ? `${realV} venda(s)` : '—'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
