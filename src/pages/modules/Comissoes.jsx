import React, { useEffect, useState } from 'react';
import { comissoesApi } from '@/lib/api/comissoes';
import { contratosApi } from '@/lib/api/contratos';
import { auditoriaApi } from '@/lib/api/auditoria';
import { brl, num, dataBR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, CheckCircle2 } from 'lucide-react';

const STATUS = { prevista: 'Prevista', paga: 'Paga', cancelada: 'Cancelada' };
const CORES = { prevista: 'bg-blue-50 text-blue-700', paga: 'bg-green-50 text-green-700', cancelada: 'bg-slate-100 text-slate-400' };
const emptyForm = { contrato_id: '', tipo: 'originacao', base_calculo: '', percentual: '', valor: '', status: 'prevista', data_pagamento: '' };

export default function Comissoes() {
  const [itens, setItens] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    const [c, ct] = await Promise.all([
      comissoesApi.list().catch(() => []),
      contratosApi.list().catch(() => []),
    ]);
    setItens(c); setContratos(ct); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEdit(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (c) => {
    setEdit(c);
    setForm({
      contrato_id: c.contrato_id || '', tipo: c.tipo || 'originacao', base_calculo: c.base_calculo ?? '',
      percentual: c.percentual ?? '', valor: c.valor ?? '', status: c.status, data_pagamento: c.data_pagamento || '',
    });
    setOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = {
      contrato_id: form.contrato_id || null, tipo: form.tipo || null,
      base_calculo: num(form.base_calculo), percentual: num(form.percentual), valor: num(form.valor),
      status: form.status, data_pagamento: form.data_pagamento || null,
    };
    if (edit) {
      await comissoesApi.update(edit.id, payload);
      await auditoriaApi.log('editar_comissao', 'comissoes', edit.id, { status: form.status });
    } else {
      await comissoesApi.create(payload);
      await auditoriaApi.log('criar_comissao', 'comissoes', null, {});
    }
    setOpen(false); load();
  };

  const marcarPaga = async (c) => {
    await comissoesApi.update(c.id, { status: 'paga', data_pagamento: new Date().toISOString().slice(0, 10) });
    await auditoriaApi.log('pagar_comissao', 'comissoes', c.id, {});
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Comissões por contrato</p>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Nova comissão</Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">Carregando...</div>
        ) : itens.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">Nenhuma comissão.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Contrato</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden sm:table-cell">Tipo</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Valor</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden lg:table-cell">Pagamento</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Status</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ações</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.contrato?.numero_contrato || (c.contrato_id ? c.contrato_id.slice(0, 8) : '—')}</td>
                  <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">{c.tipo || '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{brl(c.valor)}</td>
                  <td className="px-4 py-3 text-right text-slate-600 hidden lg:table-cell">{dataBR(c.data_pagamento)}</td>
                  <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${CORES[c.status]}`}>{STATUS[c.status]}</span></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {c.status !== 'paga' && (
                        <button title="Marcar paga" onClick={() => marcarPaga(c)} className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded"><CheckCircle2 className="w-4 h-4" /></button>
                      )}
                      <button title="Editar" onClick={() => openEdit(c)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><Pencil className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? 'Editar comissão' : 'Nova comissão'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Contrato</Label>
                <Select value={form.contrato_id} onValueChange={(v) => setForm({ ...form, contrato_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{contratos.map((c) => <SelectItem key={c.id} value={c.id}>{(c.numero_contrato || c.id.slice(0, 8)) + ' — ' + (c.cliente?.nome || '')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Tipo</Label><Input value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} placeholder="ex: originacao" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Base</Label><Input type="number" step="0.01" value={form.base_calculo} onChange={(e) => setForm({ ...form, base_calculo: e.target.value })} /></div>
              <div className="space-y-2"><Label>%</Label><Input type="number" step="0.0001" value={form.percentual} onChange={(e) => setForm({ ...form, percentual: e.target.value })} /></div>
              <div className="space-y-2"><Label>Valor</Label><Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Data de pagamento</Label><Input type="date" value={form.data_pagamento} onChange={(e) => setForm({ ...form, data_pagamento: e.target.value })} /></div>
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
