import React, { useEffect, useState } from 'react';
import { carteirasApi, refinApi } from '@/lib/api/expansao';
import { contratosApi } from '@/lib/api/contratos';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { brl, dataBR, num } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil } from 'lucide-react';

/* -------- Carteiras adquiridas (14) -------- */
const CART_STATUS = { prospeccao: 'Prospecção', due_diligence: 'Due diligence', precificada: 'Precificada', adquirida: 'Adquirida', descartada: 'Descartada' };
const CART_CORES = { prospeccao: 'bg-slate-100 text-slate-600', due_diligence: 'bg-amber-50 text-amber-700', precificada: 'bg-blue-50 text-blue-700', adquirida: 'bg-green-50 text-green-700', descartada: 'bg-red-50 text-red-700' };

function CarteirasTab() {
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const empty = { origem: '', valor_face: '', valor_aquisicao: '', desagio: '', qtd_contratos: '', status: 'prospeccao', data_referencia: '', observacao: '' };
  const [form, setForm] = useState(empty);

  const load = async () => { setLoading(true); setItens(await carteirasApi.list().catch(() => [])); setLoading(false); };
  useEffect(() => { load(); }, []);
  const openCreate = () => { setEdit(null); setForm(empty); setOpen(true); };
  const openEdit = (c) => { setEdit(c); setForm({ origem: c.origem, valor_face: c.valor_face ?? '', valor_aquisicao: c.valor_aquisicao ?? '', desagio: c.desagio ?? '', qtd_contratos: c.qtd_contratos ?? '', status: c.status, data_referencia: c.data_referencia || '', observacao: c.observacao || '' }); setOpen(true); };
  const handleSave = async (e) => {
    e.preventDefault();
    const payload = { origem: form.origem, valor_face: num(form.valor_face), valor_aquisicao: num(form.valor_aquisicao), desagio: num(form.desagio), qtd_contratos: num(form.qtd_contratos), status: form.status, data_referencia: form.data_referencia || null, observacao: form.observacao || null };
    try {
      if (edit) { await carteirasApi.update(edit.id, payload); await auditoriaApi.log('editar_carteira', 'carteiras_adquiridas', edit.id, {}); }
      else { await carteirasApi.create(payload); await auditoriaApi.log('criar_carteira', 'carteiras_adquiridas', null, {}); }
      setOpen(false); load();
    } catch (err) { alert(err.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Aquisição de carteiras de terceiros (due diligence e precificação)</p>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Nova carteira</Button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-12 text-center text-sm text-slate-400">Carregando...</div>
        : itens.length === 0 ? <div className="p-12 text-center text-sm text-slate-400">Nenhuma carteira.</div>
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Origem</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Face</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Aquisição</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden md:table-cell">Contratos</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Status</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ações</th>
            </tr></thead>
            <tbody>
              {itens.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{c.origem}</td>
                  <td className="px-4 py-3 text-right num text-slate-700">{brl(c.valor_face)}</td>
                  <td className="px-4 py-3 text-right num text-slate-700">{brl(c.valor_aquisicao)}</td>
                  <td className="px-4 py-3 text-right text-slate-600 hidden md:table-cell num">{c.qtd_contratos ?? '—'}</td>
                  <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${CART_CORES[c.status]}`}>{CART_STATUS[c.status]}</span></td>
                  <td className="px-4 py-3 text-right"><button onClick={() => openEdit(c)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><Pencil className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? 'Editar carteira' : 'Nova carteira'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2"><Label>Origem</Label><Input value={form.origem} onChange={(e) => setForm({ ...form, origem: e.target.value })} required /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Valor de face</Label><Input type="number" step="0.01" value={form.valor_face} onChange={(e) => setForm({ ...form, valor_face: e.target.value })} /></div>
              <div className="space-y-2"><Label>Aquisição</Label><Input type="number" step="0.01" value={form.valor_aquisicao} onChange={(e) => setForm({ ...form, valor_aquisicao: e.target.value })} /></div>
              <div className="space-y-2"><Label>Deságio %</Label><Input type="number" step="0.0001" value={form.desagio} onChange={(e) => setForm({ ...form, desagio: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Qtd contratos</Label><Input type="number" value={form.qtd_contratos} onChange={(e) => setForm({ ...form, qtd_contratos: e.target.value })} /></div>
              <div className="space-y-2"><Label>Data ref.</Label><Input type="date" value={form.data_referencia} onChange={(e) => setForm({ ...form, data_referencia: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CART_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
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

/* -------- Refinanciamento (15) -------- */
const REF_STATUS = { fila: 'Fila', simulado: 'Simulado', aprovado: 'Aprovado', emitido: 'Emitido', recusado: 'Recusado' };
const REF_CORES = { fila: 'bg-slate-100 text-slate-600', simulado: 'bg-blue-50 text-blue-700', aprovado: 'bg-amber-50 text-amber-700', emitido: 'bg-green-50 text-green-700', recusado: 'bg-red-50 text-red-700' };

function RefinTab() {
  const { activeUnidade } = useAuth();
  const [itens, setItens] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const empty = { contrato_original_id: '', valor_quitacao: '', valor_novo: '', troco: '', status: 'fila', observacao: '' };
  const [form, setForm] = useState(empty);

  const load = async () => { setLoading(true); const [r, c] = await Promise.all([refinApi.list().catch(() => []), contratosApi.list().catch(() => [])]); setItens(r); setContratos(c); setLoading(false); };
  useEffect(() => { load(); }, []);
  const openCreate = () => { setEdit(null); setForm(empty); setOpen(true); };
  const openEdit = (r) => { setEdit(r); setForm({ contrato_original_id: r.contrato_original_id || '', valor_quitacao: r.valor_quitacao ?? '', valor_novo: r.valor_novo ?? '', troco: r.troco ?? '', status: r.status, observacao: r.observacao || '' }); setOpen(true); };
  const handleSave = async (e) => {
    e.preventDefault();
    const cli = contratos.find((c) => c.id === form.contrato_original_id);
    const payload = { contrato_original_id: form.contrato_original_id || null, cliente_id: cli?.cliente_id || null, valor_quitacao: num(form.valor_quitacao), valor_novo: num(form.valor_novo), troco: num(form.troco), status: form.status, observacao: form.observacao || null, franquia_id: activeUnidade?.id || null };
    try {
      if (edit) { await refinApi.update(edit.id, payload); await auditoriaApi.log('editar_refin', 'refinanciamentos', edit.id, { status: form.status }); }
      else { await refinApi.create(payload); await auditoriaApi.log('criar_refin', 'refinanciamentos', null, {}); }
      setOpen(false); load();
    } catch (err) { alert(err.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Refinanciamento — fila, simulação e nova CCB (vínculo original ↔ nova)</p>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Novo refin</Button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-12 text-center text-sm text-slate-400">Carregando...</div>
        : itens.length === 0 ? <div className="p-12 text-center text-sm text-slate-400">Nenhum refinanciamento.</div>
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Cliente</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Quitação</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Novo</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden md:table-cell">Troco</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Status</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ações</th>
            </tr></thead>
            <tbody>
              {itens.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{r.cliente?.nome || r.contrato?.cliente?.nome || '—'}</td>
                  <td className="px-4 py-3 text-right num text-slate-700">{brl(r.valor_quitacao)}</td>
                  <td className="px-4 py-3 text-right num text-slate-700">{brl(r.valor_novo)}</td>
                  <td className="px-4 py-3 text-right num text-slate-600 hidden md:table-cell">{brl(r.troco)}</td>
                  <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${REF_CORES[r.status]}`}>{REF_STATUS[r.status]}</span></td>
                  <td className="px-4 py-3 text-right"><button onClick={() => openEdit(r)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><Pencil className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? 'Editar refinanciamento' : 'Novo refinanciamento'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Contrato original</Label>
              <Select value={form.contrato_original_id} onValueChange={(v) => setForm({ ...form, contrato_original_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{contratos.map((c) => <SelectItem key={c.id} value={c.id}>{(c.numero_contrato || c.id.slice(0, 8)) + ' — ' + (c.cliente?.nome || '')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Quitação</Label><Input type="number" step="0.01" value={form.valor_quitacao} onChange={(e) => setForm({ ...form, valor_quitacao: e.target.value })} /></div>
              <div className="space-y-2"><Label>Novo valor</Label><Input type="number" step="0.01" value={form.valor_novo} onChange={(e) => setForm({ ...form, valor_novo: e.target.value })} /></div>
              <div className="space-y-2"><Label>Troco</Label><Input type="number" step="0.01" value={form.troco} onChange={(e) => setForm({ ...form, troco: e.target.value })} /></div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(REF_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
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

const TABS = [{ key: 'carteiras', label: 'Carteiras adquiridas' }, { key: 'refin', label: 'Refinanciamento' }];
export default function Expansao() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState('carteiras');
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Expansão</h1>
        <p className="text-sm text-slate-500 mt-1">Carteiras adquiridas de terceiros e refinanciamento</p>
      </div>
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {!isAdmin ? <p className="text-sm text-slate-500">Restrito a administradores do grupo.</p>
        : tab === 'carteiras' ? <CarteirasTab /> : <RefinTab />}
    </div>
  );
}
