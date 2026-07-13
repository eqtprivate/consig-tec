import React, { useEffect, useMemo, useState } from 'react';
import { conveniosApi } from '@/lib/api/convenios';
import { produtosConvenioApi } from '@/lib/api/produtosConvenio';
import { capacidadeApi } from '@/lib/api/capacidade';
import CountUp from '@/components/CountUp';
import { brl } from '@/lib/format';
import { Building2, Package, Wallet, Users, Star, CheckCircle2, AlertTriangle, RefreshCw, MapPin, TrendingUp } from 'lucide-react';

const TIPOS = { publico: 'Público', privado: 'Privado', inss: 'INSS', militar: 'Militar' };
const MARGENS = { apartada: 'Apartada', principal: 'Principal', cartao: 'Cartão' };
const ORIGENS = { manual: 'Manual', csv: 'CSV', pixconsig: 'PixConsig' };
const PRODUTOS = { cartao_beneficio: 'Cartão Benefício', consignado: 'Consignado', cartao_credito: 'Cartão de Crédito', saque_complementar: 'Saque Complementar' };
const PRIO = {
  alta: { label: 'Alta', cls: 'bg-green-500' },
  media: { label: 'Média', cls: 'bg-amber-500' },
  baixa: { label: 'Baixa', cls: 'bg-slate-400' },
  sem_prioridade: { label: 'Sem prioridade', cls: 'bg-slate-300' },
};
const ov1 = (c) => (Array.isArray(c.overlay) ? c.overlay[0] : c.overlay) || null;

function Kpi({ icon: Icon, label, value, sub, money, accent = 'text-primary' }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 text-slate-400 mb-1"><Icon className={`w-4 h-4 ${accent}`} /><span className="text-[11px] uppercase tracking-wide">{label}</span></div>
      <p className="text-2xl font-bold text-slate-900">
        {money ? brl(value) : <CountUp value={value} />}
      </p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// Lista de barras de distribuição (contagem relativa ao máximo).
function Dist({ title, rows, colorFor, right }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-sm font-semibold text-slate-700 mb-3">{title}</p>
      <div className="space-y-2.5">
        {rows.length === 0 ? <p className="text-xs text-slate-400">Sem dados.</p> : rows.map((r) => (
          <div key={r.key} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-xs text-slate-600 truncate" title={r.label}>{r.label}</span>
            <div className="flex-1 h-2 bg-slate-100 rounded overflow-hidden">
              <div className={`h-full rounded ${colorFor ? colorFor(r.key) : 'bar-brand'}`} style={{ width: `${(r.value / max) * 100}%` }} />
            </div>
            <span className="w-16 shrink-0 text-right text-xs font-medium text-slate-700">{right ? right(r) : r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const contar = (arr, keyFn, labels) => {
  const m = new Map();
  for (const it of arr) { const k = keyFn(it) || 'indef'; m.set(k, (m.get(k) || 0) + 1); }
  return Object.entries(labels)
    .map(([key, label]) => ({ key, label, value: m.get(key) || 0 }))
    .filter((r) => r.value > 0);
};

export default function ConveniosDashboard() {
  const [convenios, setConvenios] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [cap, setCap] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [c, p, k] = await Promise.all([
        conveniosApi.list().catch(() => []),
        produtosConvenioApi.list().catch(() => []),
        capacidadeApi.porConvenio().catch(() => []),
      ]);
      setConvenios(c); setProdutos(p); setCap(k); setLoading(false);
    })();
  }, []);

  const m = useMemo(() => {
    const total = convenios.length;
    const ativos = convenios.filter((c) => c.ativo).length;
    const habilitados = convenios.filter((c) => ov1(c)?.habilitado_canal).length;
    const comProduto = new Set(produtos.map((p) => p.convenio_id));
    const semProduto = convenios.filter((c) => !comProduto.has(c.id)).length;
    const pix = convenios.filter((c) => c.origem_dado === 'pixconsig').length;
    const ativosSemMargem = convenios.filter((c) => c.ativo && c.percentual_margem_apartada == null).length;

    const porOrigem = contar(convenios, (c) => c.origem_dado || 'manual', ORIGENS);
    const porTipo = contar(convenios, (c) => c.tipo, TIPOS);
    const porMargem = contar(convenios, (c) => c.tipo_margem, MARGENS);
    const prodPorTipo = contar(produtos, (p) => p.produto, PRODUTOS);

    // Capacidade
    const margemTotal = cap.reduce((s, r) => s + Number(r.margem_disponivel || 0), 0);
    const prioritarios = cap.filter((r) => ['alta', 'media'].includes(r.prioridade_comercial));
    const margemPrio = prioritarios.reduce((s, r) => s + Number(r.margem_disponivel || 0), 0);
    const tomadores = cap.reduce((s, r) => s + Number(r.tomadores || 0), 0);
    const vinculos = cap.reduce((s, r) => s + Number(r.vinculos_elegiveis || 0), 0);
    const ticketMedio = tomadores > 0 ? margemTotal / tomadores : 0;

    const capPorPrio = Object.entries(PRIO).map(([key, v]) => {
      const rows = cap.filter((r) => (r.prioridade_comercial || 'sem_prioridade') === key);
      return { key, label: v.label, value: rows.length, margem: rows.reduce((s, r) => s + Number(r.margem_disponivel || 0), 0) };
    }).filter((r) => r.value > 0);

    const topMargem = [...cap]
      .sort((a, b) => Number(b.margem_disponivel || 0) - Number(a.margem_disponivel || 0))
      .slice(0, 6)
      .map((r) => ({ key: r.convenio_id, label: `${r.cidade || r.nome}${r.uf ? `/${r.uf}` : ''}`, value: Number(r.margem_disponivel || 0) }));

    // UF (por convênio, via entidade)
    const ufMap = new Map();
    for (const c of convenios) { const uf = c.entidade?.uf; if (uf) ufMap.set(uf, (ufMap.get(uf) || 0) + 1); }
    const topUF = [...ufMap.entries()].map(([uf, n]) => ({ key: uf, label: uf, value: n })).sort((a, b) => b.value - a.value).slice(0, 6);

    return {
      total, ativos, habilitados, semProduto, pix, ativosSemMargem,
      porOrigem, porTipo, porMargem, prodPorTipo,
      margemTotal, margemPrio, tomadores, vinculos, ticketMedio, prioritarios: prioritarios.length,
      capPorPrio, topMargem, topUF, produtosTotal: produtos.length, municipiosCap: cap.length,
    };
  }, [convenios, produtos, cap]);

  if (loading) return <div className="p-12 text-center text-sm text-slate-400">Carregando indicadores…</div>;

  const pctPix = m.total > 0 ? Math.round((m.pix / m.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* ===== CONVÊNIOS & PRODUTOS ===== */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" /> Convênios & Produtos</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi icon={Building2} label="Convênios" value={m.total} sub={`${m.ativos} ativo(s) · ${m.total - m.ativos} inativo(s)`} />
          <Kpi icon={Package} label="Produtos parametrizados" value={m.produtosTotal} sub={m.semProduto > 0 ? `${m.semProduto} convênio(s) sem produto` : 'todos com produto'} accent="text-indigo-500" />
          <Kpi icon={CheckCircle2} label="Habilitados p/ canal" value={m.habilitados} sub={`de ${m.total} convênio(s)`} accent="text-green-500" />
          <Kpi icon={RefreshCw} label="Origem PixConsig" value={m.pix} sub={`${pctPix}% do espelho`} accent="text-blue-500" />
        </div>

        {(m.semProduto > 0 || m.ativosSemMargem > 0) && (
          <div className="flex flex-wrap gap-2">
            {m.semProduto > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-lg px-3 py-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> {m.semProduto} convênio(s) sem produto parametrizado
              </span>
            )}
            {m.ativosSemMargem > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-lg px-3 py-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> {m.ativosSemMargem} ativo(s) sem margem apartada definida
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <Dist title="Por origem do dado" rows={m.porOrigem} colorFor={(k) => k === 'pixconsig' ? 'bg-blue-500' : k === 'csv' ? 'bg-amber-500' : 'bg-slate-400'} />
          <Dist title="Por tipo de convênio" rows={m.porTipo} />
          <Dist title="Por tipo de margem" rows={m.porMargem} colorFor={(k) => k === 'apartada' ? 'bg-emerald-500' : k === 'principal' ? 'bg-indigo-500' : 'bg-violet-500'} />
          <Dist title="Produtos por tipo" rows={m.prodPorTipo} colorFor={() => 'bg-indigo-500'} />
        </div>
      </section>

      {/* ===== CAPACIDADE POR MUNICÍPIO ===== */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Capacidade por Município</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi icon={Wallet} label="Margem elegível total" value={m.margemTotal} money accent="text-emerald-500" />
          <Kpi icon={Star} label="Margem em prioritários" value={m.margemPrio} money sub={`${m.prioritarios} município(s) alta/média`} accent="text-amber-500" />
          <Kpi icon={Users} label="Tomadores elegíveis" value={m.tomadores} sub={`${m.vinculos} vínculo(s)`} accent="text-sky-500" />
          <Kpi icon={TrendingUp} label="Ticket médio (margem)" value={m.ticketMedio} money sub={`${m.municipiosCap} município(s)`} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <Dist
            title="Municípios por prioridade"
            rows={m.capPorPrio}
            colorFor={(k) => PRIO[k]?.cls || 'bg-slate-300'}
            right={(r) => `${r.value} · ${brl(r.margem)}`}
          />
          <Dist title="Top municípios por margem" rows={m.topMargem} colorFor={() => 'bg-emerald-500'} right={(r) => brl(r.value)} />
          <Dist title="Convênios por UF" rows={m.topUF} />
        </div>
      </section>
    </div>
  );
}
