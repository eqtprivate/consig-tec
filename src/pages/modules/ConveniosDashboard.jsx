import React, { useEffect, useMemo, useState } from 'react';
import { conveniosApi } from '@/lib/api/convenios';
import { produtosConvenioApi } from '@/lib/api/produtosConvenio';
import { capacidadeApi } from '@/lib/api/capacidade';
import CountUp from '@/components/CountUp';
import { Panel, EmptyState } from '@/components/kit';
import { brl } from '@/lib/format';
import {
  Building2, Package, Wallet, Users, Star, CheckCircle2, AlertTriangle, RefreshCw, MapPin,
  TrendingUp, Percent, Landmark, Gauge, Target, ScrollText,
} from 'lucide-react';

const TIPOS = { publico: 'Público', privado: 'Privado', inss: 'INSS', militar: 'Militar' };
const MARGENS = { apartada: 'Apartada', principal: 'Principal', cartao: 'Cartão' };
const ORIGENS = { manual: 'Manual', csv: 'CSV', pixconsig: 'PixConsig' };
const PRODUTOS = { cartao_beneficio: 'Cartão Benefício', consignado: 'Consignado', cartao_credito: 'Cartão de Crédito', saque_complementar: 'Saque Complementar' };
const STATUS_DET = {
  ATIVA: 'Ativa', AGUARDANDO_DECRETO: 'Aguardando decreto', AGUARDANDO_ANALISE: 'Aguardando análise',
  EM_ANALISE: 'Em análise', REPROVADA: 'Reprovada', INATIVA: 'Inativa', SUSPENSA: 'Suspensa',
};
const PRIO = {
  alta: { label: 'Alta', cls: 'bg-green-500' },
  media: { label: 'Média', cls: 'bg-amber-500' },
  baixa: { label: 'Baixa', cls: 'bg-muted-foreground' },
  sem_prioridade: { label: 'Sem prioridade', cls: 'bg-muted-foreground' },
};
const CAPAG_CLS = { A: 'bg-emerald-500', B: 'bg-green-500', C: 'bg-amber-500', D: 'bg-red-500' };
const ov1 = (c) => (Array.isArray(c.overlay) ? c.overlay[0] : c.overlay) || null;
const pretty = (s) => String(s).replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
const pct = (v) => (v == null ? '—' : `${Number(v).toFixed(2)}%`);
const avg = (arr, f) => {
  const xs = arr.map(f).filter((v) => v != null && v !== '' && Number.isFinite(Number(v))).map(Number);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
};
const sumF = (arr, f) => arr.reduce((s, r) => s + (Number(f(r)) || 0), 0);

function Kpi({ icon: Icon, label, value, sub, money, accent = 'text-primary', render }) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1"><Icon className={`w-4 h-4 ${accent}`} /><span className="text-[11px] uppercase tracking-wide">{label}</span></div>
      <p className="text-2xl font-bold text-foreground">
        {render != null ? render : money ? brl(value) : <CountUp value={value} />}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function Dist({ title, rows, colorFor, right }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Panel title={title}>
      <div className="space-y-2.5">
        {rows.length === 0 ? <p className="text-xs text-muted-foreground">Sem dados.</p> : rows.map((r) => (
          <div key={r.key} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-xs text-muted-foreground truncate" title={r.label}>{r.label}</span>
            <div className="flex-1 h-2 bg-muted rounded overflow-hidden">
              <div className={`h-full rounded ${colorFor ? colorFor(r.key) : 'bar-brand'}`} style={{ width: `${(r.value / max) * 100}%` }} />
            </div>
            <span className="w-20 shrink-0 text-right text-xs font-medium text-muted-foreground">{right ? right(r) : r.value}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Chip({ children }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-lg px-3 py-1.5">
      <AlertTriangle className="w-3.5 h-3.5" /> {children}
    </span>
  );
}

// Contagem por chave conhecida (mantém ordem do mapa de labels).
const contar = (arr, keyFn, labels) => {
  const m = new Map();
  for (const it of arr) { const k = keyFn(it) || 'indef'; m.set(k, (m.get(k) || 0) + 1); }
  return Object.entries(labels).map(([key, label]) => ({ key, label, value: m.get(key) || 0 })).filter((r) => r.value > 0);
};
// Frequência genérica por valor (top N, com bucket "sem info").
const freq = (arr, keyFn, { labelMap, topN = 8, emptyLabel = 'Sem info' } = {}) => {
  const m = new Map();
  for (const it of arr) {
    let k = keyFn(it);
    k = k == null || k === '' ? '__none__' : String(k);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()]
    .map(([key, value]) => ({ key, value, label: key === '__none__' ? emptyLabel : (labelMap?.[key] || labelMap?.[key.toUpperCase?.()] || pretty(key)) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, topN);
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
    const hoje = new Date();
    const em90 = new Date(hoje.getTime() + 90 * 864e5);
    const capagDe = (c) => (c.capag || c.entidade?.capag || null);

    const total = convenios.length;
    const ativos = convenios.filter((c) => c.ativo).length;
    const habilitados = convenios.filter((c) => ov1(c)?.habilitado_canal).length;
    const comProduto = new Set(produtos.map((p) => p.convenio_id));
    const semProduto = convenios.filter((c) => !comProduto.has(c.id)).length;
    const pix = convenios.filter((c) => c.origem_dado === 'pixconsig').length;
    const ativosSemMargem = convenios.filter((c) => c.ativo && c.percentual_margem_apartada == null).length;

    // médias
    const taxaMedia = avg(convenios, (c) => c.taxa_mensal);
    const margemMedia = avg(convenios, (c) => c.percentual_margem_apartada);
    const comissaoMedia = avg(convenios.map(ov1).filter(Boolean), (o) => o.comissao_prefeitura);
    const spreadMedio = avg(convenios, (c) => (c.spread ?? ov1(c)?.spread));
    const prazoMedio = avg(convenios, (c) => c.prazo_maximo);

    // cobertura populacional
    const populacao = sumF(convenios, (c) => c.entidade?.populacao);
    const servidores = sumF(convenios, (c) => c.entidade?.servidores);

    // atenção
    const decretoPendente = convenios.filter((c) => c.status_detalhado === 'AGUARDANDO_DECRETO' || c.decreto_enviado === false).length;
    const vigVencida = convenios.filter((c) => { const f = c.entidade?.vigencia_fim; return f && new Date(f) < hoje; }).length;
    const vigVencendo = convenios.filter((c) => { const f = c.entidade?.vigencia_fim; return f && new Date(f) >= hoje && new Date(f) <= em90; }).length;
    const syncErro = convenios.filter((c) => c.status_sync === 'erro').length;

    // distribuições
    const porOrigem = contar(convenios, (c) => c.origem_dado || 'manual', ORIGENS);
    const porTipo = contar(convenios, (c) => c.tipo, TIPOS);
    const porMargem = contar(convenios, (c) => c.tipo_margem, MARGENS);
    const prodPorTipo = contar(produtos, (p) => p.produto, PRODUTOS);
    const porCapag = freq(convenios, capagDe, { labelMap: { A: 'CAPAG A', B: 'CAPAG B', C: 'CAPAG C', D: 'CAPAG D' } });
    const porStatus = freq(convenios, (c) => c.status_detalhado, { labelMap: STATUS_DET });
    const porNorma = freq(convenios, (c) => c.norma_autorizadora || c.entidade?.norma_autorizadora, {});
    const porSistema = freq(convenios, (c) => c.entidade?.sistema_averbacao, {});

    // produtos
    const prodAtivos = produtos.filter((p) => p.ativo).length;
    const prodComTaxa = produtos.filter((p) => p.taxa_mensal != null).length;
    const prodRotativo = produtos.filter((p) => p.rotativo).length;

    // ===== Capacidade =====
    const margemTotal = sumF(cap, (r) => r.margem_disponivel);
    const margemUtil = sumF(cap, (r) => r.margem_utilizada);
    const prioritarios = cap.filter((r) => ['alta', 'media'].includes(r.prioridade_comercial));
    const margemPrio = sumF(prioritarios, (r) => r.margem_disponivel);
    const tomadores = sumF(cap, (r) => r.tomadores);
    const vinculos = sumF(cap, (r) => r.vinculos_elegiveis);
    const ticketMedio = tomadores > 0 ? margemTotal / tomadores : 0;
    const utilizacao = margemTotal + margemUtil > 0 ? (margemUtil / (margemTotal + margemUtil)) * 100 : 0;
    const potencial = sumF(cap, (r) => r.potencial_vendas);

    const capPorPrio = Object.entries(PRIO).map(([key, v]) => {
      const rows = cap.filter((r) => (r.prioridade_comercial || 'sem_prioridade') === key);
      return { key, label: v.label, value: rows.length, margem: sumF(rows, (r) => r.margem_disponivel) };
    }).filter((r) => r.value > 0);

    const topMargem = [...cap].sort((a, b) => Number(b.margem_disponivel || 0) - Number(a.margem_disponivel || 0)).slice(0, 6)
      .map((r) => ({ key: r.convenio_id, label: `${r.cidade || r.nome}${r.uf ? `/${r.uf}` : ''}`, value: Number(r.margem_disponivel || 0) }));
    const topTomadores = [...cap].sort((a, b) => Number(b.tomadores || 0) - Number(a.tomadores || 0)).slice(0, 6)
      .filter((r) => Number(r.tomadores) > 0).map((r) => ({ key: r.convenio_id, label: `${r.cidade || r.nome}${r.uf ? `/${r.uf}` : ''}`, value: Number(r.tomadores || 0) }));

    // por UF (convênios e margem)
    const ufConv = new Map(); const ufMargem = new Map();
    for (const c of convenios) { const uf = c.entidade?.uf; if (uf) ufConv.set(uf, (ufConv.get(uf) || 0) + 1); }
    for (const r of cap) { const uf = r.uf; if (uf) ufMargem.set(uf, (ufMargem.get(uf) || 0) + Number(r.margem_disponivel || 0)); }
    const topUF = [...ufConv.entries()].map(([uf, n]) => ({ key: uf, label: uf, value: n })).sort((a, b) => b.value - a.value).slice(0, 8);
    const margemUF = [...ufMargem.entries()].map(([uf, v]) => ({ key: uf, label: uf, value: v })).sort((a, b) => b.value - a.value).slice(0, 8);

    return {
      total, ativos, habilitados, semProduto, pix, ativosSemMargem, produtosTotal: produtos.length,
      taxaMedia, margemMedia, comissaoMedia, spreadMedio, prazoMedio, populacao, servidores,
      decretoPendente, vigVencida, vigVencendo, syncErro,
      porOrigem, porTipo, porMargem, prodPorTipo, porCapag, porStatus, porNorma, porSistema,
      prodAtivos, prodComTaxa, prodRotativo,
      margemTotal, margemUtil, margemPrio, tomadores, vinculos, ticketMedio, utilizacao, potencial,
      prioritarios: prioritarios.length, municipiosCap: cap.length,
      capPorPrio, topMargem, topTomadores, topUF, margemUF,
    };
  }, [convenios, produtos, cap]);

  if (loading) return <EmptyState title="Carregando indicadores…" />;

  const pctPix = m.total > 0 ? Math.round((m.pix / m.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* ===== CONVÊNIOS & PRODUTOS ===== */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" /> Convênios & Produtos</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi icon={Building2} label="Convênios" value={m.total} sub={`${m.ativos} ativo(s) · ${m.total - m.ativos} inativo(s)`} />
          <Kpi icon={Package} label="Produtos" value={m.produtosTotal} sub={`${m.prodAtivos} ativo(s) · ${m.prodComTaxa} com taxa`} accent="text-indigo-500" />
          <Kpi icon={CheckCircle2} label="Habilitados p/ canal" value={m.habilitados} sub={`de ${m.total} convênio(s)`} accent="text-green-500" />
          <Kpi icon={RefreshCw} label="Origem PixConsig" value={m.pix} sub={`${pctPix}% do espelho`} accent="text-blue-500" />
          <Kpi icon={Percent} label="Taxa média a.m." render={pct(m.taxaMedia)} accent="text-rose-500" />
          <Kpi icon={Gauge} label="Margem apartada média" render={pct(m.margemMedia)} accent="text-emerald-500" />
          <Kpi icon={Landmark} label="Comissão prefeitura média" render={pct(m.comissaoMedia)} accent="text-amber-500" />
          <Kpi icon={Users} label="População coberta" value={m.populacao} sub={`${m.servidores.toLocaleString('pt-BR')} servidor(es)`} accent="text-sky-500" />
        </div>

        {(m.semProduto > 0 || m.ativosSemMargem > 0 || m.decretoPendente > 0 || m.vigVencida > 0 || m.vigVencendo > 0 || m.syncErro > 0) && (
          <div className="flex flex-wrap gap-2">
            {m.semProduto > 0 && <Chip>{m.semProduto} convênio(s) sem produto parametrizado</Chip>}
            {m.ativosSemMargem > 0 && <Chip>{m.ativosSemMargem} ativo(s) sem margem apartada</Chip>}
            {m.decretoPendente > 0 && <Chip>{m.decretoPendente} com decreto pendente</Chip>}
            {m.vigVencida > 0 && <Chip>{m.vigVencida} com vigência vencida</Chip>}
            {m.vigVencendo > 0 && <Chip>{m.vigVencendo} vencendo em 90 dias</Chip>}
            {m.syncErro > 0 && <Chip>{m.syncErro} com erro de sincronização</Chip>}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <Dist title="Por origem do dado" rows={m.porOrigem} colorFor={(k) => k === 'pixconsig' ? 'bg-blue-500' : k === 'csv' ? 'bg-amber-500' : 'bg-muted-foreground'} />
          <Dist title="Por tipo de convênio" rows={m.porTipo} />
          <Dist title="Por tipo de margem" rows={m.porMargem} colorFor={(k) => k === 'apartada' ? 'bg-emerald-500' : k === 'principal' ? 'bg-indigo-500' : 'bg-violet-500'} />
          <Dist title="Produtos por tipo" rows={m.prodPorTipo} colorFor={() => 'bg-indigo-500'} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <Dist title="Por CAPAG" rows={m.porCapag} colorFor={(k) => CAPAG_CLS[k] || 'bg-muted-foreground'} />
          <Dist title="Por status (credenciamento)" rows={m.porStatus} colorFor={(k) => k === 'ATIVA' ? 'bg-green-500' : k === 'REPROVADA' ? 'bg-red-500' : 'bg-amber-500'} />
          <Dist title="Norma autorizadora" rows={m.porNorma} colorFor={() => 'bg-muted-foreground'} />
          <Dist title="Sistema de averbação" rows={m.porSistema} colorFor={() => 'bg-cyan-600'} />
        </div>
      </section>

      {/* ===== CAPACIDADE POR MUNICÍPIO ===== */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Capacidade por Município</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi icon={Wallet} label="Margem elegível total" value={m.margemTotal} money accent="text-emerald-500" />
          <Kpi icon={Star} label="Margem em prioritários" value={m.margemPrio} money sub={`${m.prioritarios} município(s) alta/média`} accent="text-amber-500" />
          <Kpi icon={Users} label="Tomadores elegíveis" value={m.tomadores} sub={`${m.vinculos} vínculo(s)`} accent="text-sky-500" />
          <Kpi icon={TrendingUp} label="Ticket médio (margem)" value={m.ticketMedio} money sub={`${m.municipiosCap} município(s)`} />
          <Kpi icon={Gauge} label="Margem já utilizada" value={m.margemUtil} money accent="text-violet-500" />
          <Kpi icon={Percent} label="Utilização da margem" render={pct(m.utilizacao)} sub="utilizada / (disp. + utilizada)" accent="text-rose-500" />
          <Kpi icon={Target} label="Potencial de vendas" value={m.potencial} sub="estimativa (vendas/mês)" accent="text-indigo-500" />
          <Kpi icon={ScrollText} label="Prazo máximo médio" render={m.prazoMedio != null ? `${Math.round(m.prazoMedio)}x` : '—'} accent="text-muted-foreground" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <Dist title="Municípios por prioridade" rows={m.capPorPrio} colorFor={(k) => PRIO[k]?.cls || 'bg-muted-foreground'} right={(r) => `${r.value} · ${brl(r.margem)}`} />
          <Dist title="Top municípios por margem" rows={m.topMargem} colorFor={() => 'bg-emerald-500'} right={(r) => brl(r.value)} />
          <Dist title="Top municípios por tomadores" rows={m.topTomadores} colorFor={() => 'bg-sky-500'} />
          <Dist title="Convênios por UF" rows={m.topUF} />
          <Dist title="Margem elegível por UF" rows={m.margemUF} colorFor={() => 'bg-emerald-500'} right={(r) => brl(r.value)} />
        </div>
      </section>
    </div>
  );
}
