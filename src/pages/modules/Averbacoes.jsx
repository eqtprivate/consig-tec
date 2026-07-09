import React, { useEffect, useState } from 'react';
import { averbacoesApi } from '@/lib/api/averbacoes';
import { contratosApi } from '@/lib/api/contratos';
import { auditoriaApi } from '@/lib/api/auditoria';
import { dataBR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil } from 'lucide-react';

const STATUS = { pendente: 'Pendente', averbada: 'Averbada', recusada: 'Recusada', cancelada: 'Cancelada' };
const CORES = {
  pendente: 'bg-amber-50 text-amber-700', averbada: 'bg-green-50 text-green-700',
  recusada: 'bg-red-50 text-red-700', cancelada: 'bg-slate-100 text-slate-400',
};
const emptyForm = { contrato_id: '', convenio_id: '', protocolo: '', status: 'pendente', data_averbacao: '', motivo_recusa: '' };

export default function Averbacoes() {
  const [itens, setItens] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    const [a, c] = await Promise.all([
      averbacoesApi.list().catch(() => []),
      contratosApi.list().catch(() => []),
    ]);
    setItens(a); setContratos(c); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEdit(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (a) => {
    setEdit(a);
    setForm({
      contrato_id: a.contrato_id, convenio_id: a.convenio_id || '', protocolo: a.protocolo || '',
      status: a.status, data_averbacao: a.data_averbacao || '', motivo_recusa: a.motivo_recusa || '',
    });
    setOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.contrato_id) return alert('Selecione o contrato.');
    const contrato = contratos.find((c) => c.id === form.contrato_id);
    const payload = {
      contrato_id: form.contrato_id, convenio_id: form.convenio_id || contrato?.convenio_id || null,
      protocolo: form.protocolo || null, status: form.status,
      data_averbacao: form.data_averbacao || null, motivo_recusa: form.motivo_recusa || null,
    };
    if (edit) {
      await averbacoesApi.update(edit.id, payload);
      await auditoriaApi.log('editar_averbacao', 'averbacoes', edit.id, { status: form.status });
    } else {
      await averbacoesApi.create(payload);
      await auditoriaApi.log('criar_averbacao', 'averbacoes', null, {});
    }
    setOpen(false); load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Averbação dos contratos junto ao convênio</p>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Nova averbação</Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">Carregando...</div>
        ) : itens.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">Nenhuma averbação.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Contrato</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden md:table-cell">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden sm:table-cell">Protocolo</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden lg:table-cell">Data</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Status</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ações</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{a.contrato?.numero_contrato || a.contrato_id?.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-slate-700 hidden md:table-cell">{a.contrato?.cliente?.nome || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">{a.protocolo || '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-600 hidden lg:table-cell">{dataBR(a.data_averbacao)}</td>
                  <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${CORES[a.status]}`}>{STATUS[a.status]}</span></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(a)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><Pencil className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? 'Editar averbação' : 'Nova averbação'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Contrato</Label>
              <Select value={form.contrato_id} onValueChange={(v) => setForm({ ...form, contrato_id: v })} disabled={!!edit}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {contratos.map((c) => <SelectItem key={c.id} value={c.id}>{(c.numero_contrato || c.id.slice(0, 8)) + ' — ' + (c.cliente?.nome || '')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Protocolo</Label><Input value={form.protocolo} onChange={(e) => setForm({ ...form, protocolo: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Data da averbação</Label><Input type="date" value={form.data_averbacao} onChange={(e) => setForm({ ...form, data_averbacao: e.target.value })} /></div>
            {form.status === 'recusada' && (
              <div className="space-y-2"><Label>Motivo da recusa</Label><Textarea rows={2} value={form.motivo_recusa} onChange={(e) => setForm({ ...form, motivo_recusa: e.target.value })} /></div>
            )}
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
