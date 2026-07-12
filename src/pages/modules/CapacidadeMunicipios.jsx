import React, { useEffect, useMemo, useState } from 'react';
import { capacidadeApi } from '@/lib/api/capacidade';
import { metasComerciaisApi } from '@/lib/api/crm';
import { brl } from '@/lib/format';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Users, Wallet, Star } from 'lucide-react';

const PRIO = {
  alta: { label: 'Alta', cls: 'bg-green-100 text-green-800', ord: 0 },
  media: { label: 'Média', cls: 'bg-amber-100 text-amber-800', ord: 1 },
  baixa: { label: 'Baixa', cls: 'bg-slate-100 text-slate-600', ord: 2 },
  sem_prioridade: { label: 'Sem prioridade', cls: 'bg-slate-50 text-slate-400', ord: 3 },
};
const compAtual = () => new Date().toISOString().slice(0, 7);

export default function CapacidadeMunicipios() {
  const [rows, setRows] = useState([]);
  const [metas, setMetas] = useState([]);
  const [realizado, setRealizado] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ordenar, setOrdenar] = useState('margem');
  const [filtroPrio, setFiltroPrio] = useState('todas');
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
    let v = rows.filter((r) => (filtroPrio === 'todas' ? true : r.prioridade_comercial === filtroPrio));
    v = [...v].sort((a, b) => {
      if (ordenar === 'prioridade') {
        const pa = PRIO[a.prioridade_comercial]?.ord ?? 9, pb = PRIO[b.prioridade_comercial]?.ord ?? 9;
        if (pa !== pb) return pa - pb;
        return Number(b.margem_disponivel) - Number(a.margem_disponivel);
      }
      if (ordenar === 'tomadores') return Number(b.tomadores) - Number(a.tomadores);
      return Number(b.margem_disponivel) - Number(a.margem_disponivel);
    });
    return v;
  }, [rows, filtroPrio, ordenar]);

  const totalMargem = rows.reduce((s, r) => s + Number(r.margem_disponivel || 0), 0);
  const totalTomadores = rows.reduce((s, r) => s + Number(r.tomadores || 0), 0);
  const prioritarios = rows.filter((r) => ['alta', 'media'].includes(r.prioridade_comercial));
  const margemPrioritaria = prioritarios.reduce((s, r) => s + Number(r.margem_disponivel || 0), 0);
  const maxMargem = Math.max(1, ...rows.map((r) => Number(r.margem_disponivel || 0)));

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">Capacidade de geração de vendas por município — margem apartada elegível disponível × prioridade comercial e metas de <b>{comp}</b>.</p>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Wallet} label="Margem elegível total" value={brl(totalMargem)} />
        <Kpi icon={Star} label="Margem em prioritários" value={brl(margemPrioritaria)} sub={`${prioritarios.length} município(s) alta/média`} />
        <Kpi icon={Users} label="Tomadores elegíveis" value={String(totalTomadores)} />
        <Kpi icon={TrendingUp} label="Municípios com convênio" value={String(rows.length)} />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="w-44">
          <Select value={ordenar} onValueChange={setOrdenar}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="margem">Ordenar: margem disponível</SelectItem>
              <SelectItem value="prioridade">Ordenar: prioridade</SelectItem>
              <SelectItem value="tomadores">Ordenar: tomadores</SelectItem>
            </SelectContent>
          </Select>
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
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">Carregando...</div>
        ) : view.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">Nenhum convênio para exibir.</div>
        ) : (
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Município / Convênio</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Prioridade</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Tomadores</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Vínculos</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Margem disponível</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden lg:table-cell">Ticket médio</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Meta × Realizado</th>
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
                  <tr key={r.convenio_id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{r.cidade || r.nome}{r.uf ? `/${r.uf}` : ''}</p>
                      <p className="text-xs text-slate-500">{r.nome}{r.ativo ? '' : ' · inativo'}</p>
                    </td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${prio.cls}`}>{prio.label}</span></td>
                    <td className="px-4 py-3 text-right text-slate-700">{r.tomadores}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{r.vinculos_elegiveis}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800 whitespace-nowrap">{brl(r.margem_disponivel)}</span>
                        <div className="flex-1 h-1.5 bg-slate-100 rounded overflow-hidden min-w-[40px]">
                          <div className="h-full bar-brand rounded" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 hidden lg:table-cell">{brl(r.ticket_medio_margem)}</td>
                    <td className="px-4 py-3 text-right">
                      {metaV > 0 ? (
                        <span className={`text-sm font-medium ${realV >= metaV ? 'text-green-700' : 'text-slate-700'}`}>{realV}/{metaV}</span>
                      ) : (
                        <span className="text-xs text-slate-400">{realV > 0 ? `${realV} venda(s)` : '—'}</span>
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

function Kpi({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 text-slate-400 mb-1"><Icon className="w-4 h-4" /><span className="text-xs uppercase tracking-wide">{label}</span></div>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}
