import React, { useEffect, useState } from 'react';
import { conveniosApi } from '@/lib/api/convenios';
import { metasComerciaisApi } from '@/lib/api/crm';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { brl, num } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Target, Pencil } from 'lucide-react';

const PRIOR = { alta: 'Alta', media: 'Média', baixa: 'Baixa', sem_prioridade: 'Sem prioridade' };
const PRIOR_ORDER = { alta: 0, media: 1, baixa: 2, sem_prioridade: 3 };
const PRIOR_COR = { alta: 'bg-green-50 text-green-700', media: 'bg-amber-50 text-amber-700', baixa: 'bg-slate-100 text-slate-600', sem_prioridade: 'bg-slate-100 text-slate-400' };
function competenciaAtual() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);

export default function ComercialPlanejamento() {
  const { isAdmin, activeUnidade } = useAuth();
  const [competencia] = useState(competenciaAtual());
  const [convenios, setConvenios] = useState([]);
  const [metas, setMetas] = useState([]);
  const [realizado, setRealizado] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [alvo, setAlvo] = useState(null);
  const [form, setForm] = useState({ prioridade_comercial: 'sem_prioridade', potencial_vendas: '', observacao_comercial: '', meta_vendas: '', meta_valor: '' });

  const load = async () => {
    setLoading(true);
    const [cv, m, r] = await Promise.all([
      conveniosApi.list().catch(() => []),
      metasComerciaisApi.list({ competencia }).catch(() => []),
      metasComerciaisApi.realizado(competencia).catch(() => []),
    ]);
    setConvenios(cv); setMetas(m); setRealizado(r); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const metaDe = (cid) => metas.find((m) => m.convenio_id === cid);
  const realDe = (cid) => realizado.find((r) => r.convenio_id === cid) || { vendas: 0, valor: 0 };

  const abrir = (c) => {
    setAlvo(c);
    const m = metaDe(c.id);
    setForm({
      prioridade_comercial: c.prioridade_comercial || 'sem_prioridade',
      potencial_vendas: c.potencial_vendas ?? '',
      observacao_comercial: c.observacao_comercial || '',
      meta_vendas: m?.meta_vendas ?? '', meta_valor: m?.meta_valor ?? '',
    });
    setOpen(true);
  };
  const salvar = async (e) => {
    e.preventDefault();
    try {
      await conveniosApi.update(alvo.id, {
        prioridade_comercial: form.prioridade_comercial,
        potencial_vendas: num(form.potencial_vendas),
        observacao_comercial: form.observacao_comercial || null,
      });
      const m = metaDe(alvo.id);
      const payload = { convenio_id: alvo.id, franquia_id: activeUnidade?.id || null, competencia, meta_vendas: num(form.meta_vendas), meta_valor: num(form.meta_valor) };
      if (m) await metasComerciaisApi.update(m.id, payload);
      else if (payload.meta_vendas || payload.meta_valor) await metasComerciaisApi.create(payload);
      await auditoriaApi.log('planejamento_comercial', 'convenios', alvo.id, { prioridade: form.prioridade_comercial });
      setOpen(false); load();
    } catch (err) { alert(err.message || 'Falha ao salvar.'); }
  };

  const ordenados = [...convenios].sort((a, b) =>
    (PRIOR_ORDER[a.prioridade_comercial] ?? 3) - (PRIOR_ORDER[b.prioridade_comercial] ?? 3) || (a.nome || '').localeCompare(b.nome || ''));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 inline-flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> Planejamento comercial — prioridade dos municípios e metas ({competencia})</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-12 text-center text-sm text-slate-400">Carregando...</div>
        : ordenados.length === 0 ? <div className="p-12 text-center text-sm text-slate-400">Nenhum convênio.</div>
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Convênio / Município</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Prioridade</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden sm:table-cell">Potencial</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Meta</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Realizado</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden md:table-cell">Atingimento</th>
              {isAdmin && <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ações</th>}
            </tr></thead>
            <tbody>
              {ordenados.map((c) => {
                const meta = metaDe(c.id); const real = realDe(c.id);
                const atg = meta?.meta_vendas ? pct(Number(real.vendas), meta.meta_vendas) : null;
                return (
                  <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{c.nome}</td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${PRIOR_COR[c.prioridade_comercial]}`}>{PRIOR[c.prioridade_comercial]}</span></td>
                    <td className="px-4 py-3 text-right text-slate-600 num hidden sm:table-cell">{c.potencial_vendas ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-700 num">{meta?.meta_vendas ?? '—'}</td>
                    <td className="px-4 py-3 text-right num font-medium text-green-700">{real.vendas} · {brl(real.valor)}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {atg != null ? (
                        <div className="w-28"><div className="h-2 bg-slate-100 rounded overflow-hidden"><div className="h-full bar-brand" style={{ width: `${Math.min(atg, 100)}%` }} /></div><p className="text-[10px] text-slate-400 text-right mt-0.5">{atg}%</p></div>
                      ) : <span className="text-xs text-slate-300">sem meta</span>}
                    </td>
                    {isAdmin && <td className="px-4 py-3 text-right"><button onClick={() => abrir(c)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><Pencil className="w-4 h-4" /></button></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Planejamento — {alvo?.nome}</DialogTitle></DialogHeader>
          <form onSubmit={salvar} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Prioridade comercial</Label>
                <Select value={form.prioridade_comercial} onValueChange={(v) => setForm({ ...form, prioridade_comercial: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PRIOR).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Potencial (vendas/mês)</Label><Input type="number" value={form.potencial_vendas} onChange={(e) => setForm({ ...form, potencial_vendas: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Meta de vendas ({competencia})</Label><Input type="number" value={form.meta_vendas} onChange={(e) => setForm({ ...form, meta_vendas: e.target.value })} /></div>
              <div className="space-y-2"><Label>Meta de valor</Label><Input type="number" step="0.01" value={form.meta_valor} onChange={(e) => setForm({ ...form, meta_valor: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Observação comercial</Label><Textarea rows={2} value={form.observacao_comercial} onChange={(e) => setForm({ ...form, observacao_comercial: e.target.value })} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
