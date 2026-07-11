import React, { useEffect, useState } from 'react';
import { cobrancasApi } from '@/lib/api/operacional';
import { contratosApi } from '@/lib/api/contratos';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { brl, dataBR, num } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil } from 'lucide-react';

const GATILHO = { falha_repasse: 'Falha de repasse', inadimplencia: 'Inadimplência', glosa: 'Glosa', divergencia: 'Divergência' };
const STATUS = { aberta: 'Aberta', em_acordo: 'Em acordo', resolvida: 'Resolvida', perdida: 'Perdida' };
const CORES = { aberta: 'bg-amber-50 text-amber-700', em_acordo: 'bg-blue-50 text-blue-700', resolvida: 'bg-green-50 text-green-700', perdida: 'bg-red-50 text-red-700' };
const emptyForm = { contrato_id: '', gatilho: 'inadimplencia', valor: '', data_gatilho: '', status: 'aberta', acordo: '', observacao: '' };

export default function Cobranca() {
  const { activeUnidade } = useAuth();
  const [itens, setItens] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    const f = activeUnidade ? { franquia_id: activeUnidade.id } : {};
    const [c, ct] = await Promise.all([cobrancasApi.list(f).catch(() => []), contratosApi.list(f).catch(() => [])]);
    setItens(c); setContratos(ct); setLoading(false);
  };
  useEffect(() => { load(); }, [activeUnidade]);

  const openCreate = () => { setEdit(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (c) => {
    setEdit(c);
    setForm({ contrato_id: c.contrato_id || '', gatilho: c.gatilho, valor: c.valor ?? '', data_gatilho: c.data_gatilho || '', status: c.status, acordo: c.acordo || '', observacao: c.observacao || '' });
    setOpen(true);
  };
  const handleSave = async (e) => {
    e.preventDefault();
    const payload = { contrato_id: form.contrato_id || null, gatilho: form.gatilho, valor: num(form.valor), data_gatilho: form.data_gatilho || null, status: form.status, acordo: form.acordo || null, observacao: form.observacao || null };
    try {
      if (edit) { await cobrancasApi.update(edit.id, payload); await auditoriaApi.log('editar_cobranca', 'cobrancas', edit.id, { status: form.status }); }
      else { await cobrancasApi.create({ ...payload, franquia_id: activeUnidade?.id || null }); await auditoriaApi.log('criar_cobranca', 'cobrancas', null, {}); }
      setOpen(false); load();
    } catch (err) { alert(err.message || 'Falha ao salvar.'); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Cobrança, default e renegociação — gatilhos incl. falha de repasse/folha</p>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Nova cobrança</Button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-12 text-center text-sm text-slate-400">Carregando...</div>
        : itens.length === 0 ? <div className="p-12 text-center text-sm text-slate-400">Nenhuma cobrança.</div>
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Contrato</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden md:table-cell">Gatilho</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Valor</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden lg:table-cell">Data</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Status</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ações</th>
            </tr></thead>
            <tbody>
              {itens.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{c.contrato?.cliente?.nome || c.contrato?.numero_contrato || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{GATILHO[c.gatilho]}</td>
                  <td className="px-4 py-3 text-right text-slate-700 num">{brl(c.valor)}</td>
                  <td className="px-4 py-3 text-right text-slate-600 hidden lg:table-cell">{dataBR(c.data_gatilho)}</td>
                  <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${CORES[c.status]}`}>{STATUS[c.status]}</span></td>
                  <td className="px-4 py-3 text-right"><button onClick={() => openEdit(c)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><Pencil className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? 'Editar cobrança' : 'Nova cobrança'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Contrato</Label>
              <Select value={form.contrato_id} onValueChange={(v) => setForm({ ...form, contrato_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{contratos.map((c) => <SelectItem key={c.id} value={c.id}>{(c.numero_contrato || c.id.slice(0, 8)) + ' — ' + (c.cliente?.nome || '')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Gatilho</Label>
                <Select value={form.gatilho} onValueChange={(v) => setForm({ ...form, gatilho: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(GATILHO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Valor</Label><Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
              <div className="space-y-2"><Label>Data</Label><Input type="date" value={form.data_gatilho} onChange={(e) => setForm({ ...form, data_gatilho: e.target.value })} /></div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Acordo / renegociação</Label><Textarea rows={2} value={form.acordo} onChange={(e) => setForm({ ...form, acordo: e.target.value })} /></div>
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
