import React, { useEffect, useState } from 'react';
import { produtividadeApi, metasApi, oportunidadesApi, metasComerciaisApi } from '@/lib/api/crm';
import { usuariosApi } from '@/lib/api/usuarios';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { brl, num } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Target, Activity } from 'lucide-react';
import { Panel, EmptyState } from '@/components/kit';

function primeiroDiaMes() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; }
function hojeStr() { return new Date().toISOString().slice(0, 10); }
function competenciaAtual() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);

export default function PainelCallCenter() {
  const { isAdmin, activeUnidade } = useAuth();
  const [de, setDe] = useState(primeiroDiaMes());
  const [ate, setAte] = useState(hojeStr());
  const [prod, setProd] = useState([]);
  const [metas, setMetas] = useState([]);
  const [perdas, setPerdas] = useState([]);
  const [operadores, setOperadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [competencia] = useState(competenciaAtual());

  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const emptyMeta = { operador_id: '', meta_ligacoes: '', meta_qualificados: '', meta_vendas: '', meta_valor: '' };
  const [form, setForm] = useState(emptyMeta);

  const load = async () => {
    setLoading(true);
    const [p, m, u, pe] = await Promise.all([
      produtividadeApi.periodo(de, ate).catch(() => []),
      metasApi.list({ competencia }).catch(() => []),
      usuariosApi.list().catch(() => []),
      oportunidadesApi.perdas(de, ate).catch(() => []),
    ]);
    setProd(p); setMetas(m); setOperadores(u.filter((x) => x.ativo)); setPerdas(pe); setLoading(false);
  };
  useEffect(() => { load();   }, [de, ate]);

  const metaDe = (opId) => metas.find((m) => m.operador_id === opId);

  const openCreate = () => { setEdit(null); setForm(emptyMeta); setOpen(true); };
  const openEdit = (m) => {
    setEdit(m);
    setForm({ operador_id: m.operador_id, meta_ligacoes: m.meta_ligacoes ?? '', meta_qualificados: m.meta_qualificados ?? '', meta_vendas: m.meta_vendas ?? '', meta_valor: m.meta_valor ?? '' });
    setOpen(true);
  };
  const salvarMeta = async (e) => {
    e.preventDefault();
    const payload = { operador_id: form.operador_id, franquia_id: activeUnidade?.id || null, competencia, meta_ligacoes: num(form.meta_ligacoes), meta_qualificados: num(form.meta_qualificados), meta_vendas: num(form.meta_vendas), meta_valor: num(form.meta_valor) };
    try {
      if (edit) { await metasApi.update(edit.id, payload); await auditoriaApi.log('editar_meta', 'metas_operador', edit.id, {}); }
      else { await metasApi.create(payload); await auditoriaApi.log('criar_meta', 'metas_operador', null, {}); }
      setOpen(false); load();
    } catch (err) { alert(err.message || 'Falha ao salvar meta (pode já existir para o operador nesta competência).'); }
  };

  const derivarMetas = async () => {
    const ops = operadores;
    if (ops.length === 0) return alert('Nenhum operador ativo.');
    if (!confirm(`Derivar as metas comerciais de ${competencia} e distribuir entre ${ops.length} operador(es)?`)) return;
    try {
      const com = await metasComerciaisApi.list({ competencia }).catch(() => []);
      const totVendas = com.reduce((s, m) => s + Number(m.meta_vendas || 0), 0);
      const totValor = com.reduce((s, m) => s + Number(m.meta_valor || 0), 0);
      if (totVendas === 0 && totValor === 0) return alert('Sem metas comerciais definidas para este mês.');
      const perVendas = Math.ceil(totVendas / ops.length);
      const perValor = Math.round((totValor / ops.length) * 100) / 100;
      for (const op of ops) {
        const existente = metas.find((m) => m.operador_id === op.id);
        const payload = { operador_id: op.id, franquia_id: activeUnidade?.id || null, competencia, meta_vendas: perVendas, meta_valor: perValor };
        if (existente) await metasApi.update(existente.id, { meta_vendas: perVendas, meta_valor: perValor });
        else await metasApi.create(payload);
      }
      await auditoriaApi.log('derivar_metas_operador', 'metas_operador', null, { operadores: ops.length, competencia });
      alert(`Metas derivadas: ${perVendas} venda(s) e ${brl(perValor)} por operador.`);
      load();
    } catch (err) { alert(err.message || 'Falha ao derivar metas.'); }
  };

  // Totais
  const tot = prod.reduce((a, r) => ({
    interacoes: a.interacoes + Number(r.interacoes || 0),
    atendimentos: a.atendimentos + Number(r.atendimentos || 0),
    qualificados: a.qualificados + Number(r.qualificados || 0),
    ganhas: a.ganhas + Number(r.ganhas || 0),
    valor: a.valor + Number(r.valor_ganho || 0),
  }), { interacoes: 0, atendimentos: 0, qualificados: 0, ganhas: 0, valor: 0 });

  const perdasPorMotivo = Object.values(perdas.reduce((acc, o) => {
    const nome = o.motivo?.nome || 'Sem motivo informado';
    acc[nome] = acc[nome] || { nome, qtd: 0, valor: 0 };
    acc[nome].qtd += 1; acc[nome].valor += Number(o.valor_estimado || 0);
    return acc;
  }, {})).sort((a, b) => b.qtd - a.qtd);
  const maxPerda = Math.max(1, ...perdasPorMotivo.map((x) => x.qtd));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">Produtividade do call center e metas do operador</p>
        <div className="flex items-center gap-2">
          <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="h-9 w-36 text-sm" />
          <span className="text-muted-foreground text-sm">→</span>
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-9 w-36 text-sm" />
        </div>
      </div>

      {/* Totais do período */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          ['Interações', tot.interacoes],
          ['Atendimentos', tot.atendimentos],
          ['Taxa de contato', `${pct(tot.atendimentos, tot.interacoes)}%`],
          ['Qualificados', tot.qualificados],
          ['Vendas / valor', `${tot.ganhas} · ${brl(tot.valor)}`],
        ].map(([label, val]) => (
          <div key={label} className="bg-card rounded-xl border border-border p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-lg font-bold text-foreground num">{val}</p>
          </div>
        ))}
      </div>

      {/* Ranking de vendas (gamificação) */}
      {prod.length > 0 && (
        <Panel title="🏆 Ranking do período">
          <div className="space-y-2">
            {[...prod].sort((a, b) => Number(b.ganhas) - Number(a.ganhas) || Number(b.valor_ganho) - Number(a.valor_ganho)).slice(0, 5).map((r, i) => (
              <div key={r.operador_id} className="flex items-center gap-3">
                <span className="w-7 text-center text-lg">{['🥇', '🥈', '🥉'][i] || <span className="text-xs text-muted-foreground">{i + 1}º</span>}</span>
                <span className="flex-1 text-sm font-medium text-foreground truncate">{r.operador}</span>
                <span className="text-xs text-muted-foreground">{r.ganhas} venda(s)</span>
                <span className="w-28 text-right text-sm font-semibold text-green-700 num">{brl(r.valor_ganho)}</span>
                <span className="w-16 text-right text-xs text-muted-foreground">{pct(Number(r.atendimentos), Number(r.interacoes))}% cont.</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Produtividade por operador */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? <EmptyState title="Carregando…" />
        : prod.length === 0 ? <EmptyState icon={Activity} title="Sem atividade no período." />
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Operador</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Interações</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden sm:table-cell">Atend.</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Contato %</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden md:table-cell">Qualif.</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden lg:table-cell">Oport.</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Vendas</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden sm:table-cell">Valor</th>
            </tr></thead>
            <tbody>
              {prod.map((r) => (
                <tr key={r.operador_id} className="border-b border-border hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium text-foreground">{r.operador}</td>
                  <td className="px-4 py-3 text-right num text-muted-foreground">{r.interacoes}</td>
                  <td className="px-4 py-3 text-right num text-muted-foreground hidden sm:table-cell">{r.atendimentos}</td>
                  <td className="px-4 py-3 text-right num text-muted-foreground">{pct(Number(r.atendimentos), Number(r.interacoes))}%</td>
                  <td className="px-4 py-3 text-right num text-muted-foreground hidden md:table-cell">{r.qualificados}</td>
                  <td className="px-4 py-3 text-right num text-muted-foreground hidden lg:table-cell">{r.oportunidades}</td>
                  <td className="px-4 py-3 text-right num font-medium text-green-700">{r.ganhas}</td>
                  <td className="px-4 py-3 text-right num text-muted-foreground hidden sm:table-cell">{brl(r.valor_ganho)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Relatório de perdas por motivo */}
      {perdasPorMotivo.length > 0 && (
        <Panel title={`Perdas por motivo — ${perdas.length} oportunidade(s)`}>
          <div className="space-y-2">
            {perdasPorMotivo.map((p) => (
              <div key={p.nome} className="flex items-center gap-3">
                <span className="w-40 text-xs text-muted-foreground truncate shrink-0">{p.nome}</span>
                <div className="flex-1 h-4 bg-muted rounded overflow-hidden"><div className="h-full bg-red-400 rounded" style={{ width: `${(p.qtd / maxPerda) * 100}%` }} /></div>
                <span className="w-8 text-right text-sm font-semibold text-muted-foreground num">{p.qtd}</span>
                <span className="w-24 text-right text-xs text-muted-foreground num">{brl(p.valor)}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Metas do mês */}
      <Panel
        title={`Metas — ${competencia}`}
        action={isAdmin && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={derivarMetas} className="gap-2"><Target className="w-4 h-4" /> Derivar das comerciais</Button>
            <Button size="sm" onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Nova meta</Button>
          </div>
        )}
      >
        {metas.length === 0 ? <EmptyState icon={Target} title={`Nenhuma meta definida para ${competencia}.`} />
        : (
          <div className="space-y-2">
            {metas.map((m) => {
              const real = prod.find((p) => p.operador_id === m.operador_id) || {};
              const vendas = Number(real.ganhas || 0);
              const atingido = m.meta_vendas ? pct(vendas, m.meta_vendas) : null;
              return (
                <div key={m.id} className="flex items-center justify-between border border-border rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{m.operador?.nome || '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      Vendas {vendas}/{m.meta_vendas ?? '—'} · Ligações {real.interacoes || 0}/{m.meta_ligacoes ?? '—'} · Valor {brl(real.valor_ganho)}/{m.meta_valor ? brl(m.meta_valor) : '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {atingido != null && (
                      <div className="w-28 hidden sm:block">
                        <div className="h-2 bg-muted rounded overflow-hidden"><div className="h-full bar-brand" style={{ width: `${Math.min(atingido, 100)}%` }} /></div>
                        <p className="text-[10px] text-muted-foreground text-right mt-0.5">{atingido}%</p>
                      </div>
                    )}
                    {isAdmin && <button onClick={() => openEdit(m)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded"><Pencil className="w-4 h-4" /></button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? 'Editar meta' : 'Nova meta'} — {competencia}</DialogTitle></DialogHeader>
          <form onSubmit={salvarMeta} className="space-y-4">
            <div className="space-y-2">
              <Label>Operador</Label>
              <Select value={form.operador_id} onValueChange={(v) => setForm({ ...form, operador_id: v })} disabled={!!edit}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{operadores.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Meta ligações</Label><Input type="number" value={form.meta_ligacoes} onChange={(e) => setForm({ ...form, meta_ligacoes: e.target.value })} /></div>
              <div className="space-y-2"><Label>Meta qualificados</Label><Input type="number" value={form.meta_qualificados} onChange={(e) => setForm({ ...form, meta_qualificados: e.target.value })} /></div>
              <div className="space-y-2"><Label>Meta vendas</Label><Input type="number" value={form.meta_vendas} onChange={(e) => setForm({ ...form, meta_vendas: e.target.value })} /></div>
              <div className="space-y-2"><Label>Meta valor</Label><Input type="number" step="0.01" value={form.meta_valor} onChange={(e) => setForm({ ...form, meta_valor: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit">{edit ? 'Salvar' : 'Criar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
