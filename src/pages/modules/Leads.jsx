import React, { useEffect, useState } from 'react';
import { leadsApi, campanhasApi } from '@/lib/api/crm';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { brl } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, ChevronRight } from 'lucide-react';

const STATUS = { novo: 'Novo', contatado: 'Contatado', qualificado: 'Qualificado', convertido: 'Convertido', perdido: 'Perdido' };
const ORDER = ['novo', 'contatado', 'qualificado', 'convertido', 'perdido'];
const CHIP = {
  novo: 'bg-slate-100 text-slate-600', contatado: 'bg-blue-50 text-blue-700', qualificado: 'bg-amber-50 text-amber-700',
  convertido: 'bg-green-50 text-green-700', perdido: 'bg-red-50 text-red-700',
};
const emptyForm = { nome: '', telefone: '', email: '', cpf: '', origem: '', campanha_id: '', status: 'novo', valor_estimado: '', observacao: '' };
const num = (v) => (v === '' || v == null ? null : Number(v));

export default function Leads() {
  const { activeUnidade } = useAuth();
  const [leads, setLeads] = useState([]);
  const [campanhas, setCampanhas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    const f = activeUnidade ? { franquia_id: activeUnidade.id } : {};
    const [l, c] = await Promise.all([leadsApi.list(f).catch(() => []), campanhasApi.list(f).catch(() => [])]);
    setLeads(l); setCampanhas(c); setLoading(false);
  };
  useEffect(() => { load(); }, [activeUnidade]);

  const openCreate = () => { setEdit(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (l) => {
    setEdit(l);
    setForm({ nome: l.nome, telefone: l.telefone || '', email: l.email || '', cpf: l.cpf || '', origem: l.origem || '', campanha_id: l.campanha_id || '', status: l.status, valor_estimado: l.valor_estimado ?? '', observacao: l.observacao || '' });
    setOpen(true);
  };
  const handleSave = async (e) => {
    e.preventDefault();
    const payload = { nome: form.nome, telefone: form.telefone || null, email: form.email || null, cpf: form.cpf || null, origem: form.origem || null, campanha_id: form.campanha_id || null, status: form.status, valor_estimado: num(form.valor_estimado), observacao: form.observacao || null };
    try {
      if (edit) { await leadsApi.update(edit.id, payload); await auditoriaApi.log('editar_lead', 'leads', edit.id, { status: form.status }); }
      else { await leadsApi.create({ ...payload, franquia_id: activeUnidade?.id || null }); await auditoriaApi.log('criar_lead', 'leads', null, {}); }
      setOpen(false); load();
    } catch (err) { alert(err.message || 'Falha ao salvar lead.'); }
  };
  const avancar = async (l) => {
    const idx = ORDER.indexOf(l.status);
    if (idx < 0 || idx >= ORDER.indexOf('convertido')) return;
    const novo = ORDER[idx + 1];
    await leadsApi.update(l.id, { status: novo });
    await auditoriaApi.log('avancar_lead', 'leads', l.id, { de: l.status, para: novo });
    load();
  };

  const funil = ORDER.map((s) => ({ status: s, n: leads.filter((l) => l.status === s).length }));
  const max = Math.max(1, ...funil.map((f) => f.n));
  const convertidos = leads.filter((l) => l.status === 'convertido').length;
  const conv = leads.length ? Math.round((convertidos / leads.length) * 100) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Leads e funil comercial {conv != null && <span className="text-slate-400">· conversão {conv}%</span>}</p>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Novo lead</Button>
      </div>

      {/* Funil */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="grid grid-cols-5 gap-2">
          {funil.map((f) => (
            <div key={f.status} className="text-center">
              <div className="h-16 flex items-end justify-center">
                <div className="w-full bar-brand rounded-t" style={{ height: `${(f.n / max) * 100}%`, minHeight: f.n ? 6 : 0 }} />
              </div>
              <p className="text-lg font-bold text-slate-800 num mt-1">{f.n}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">{STATUS[f.status]}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-12 text-center text-sm text-slate-400">Carregando...</div>
        : leads.length === 0 ? <div className="p-12 text-center text-sm text-slate-400">Nenhum lead.</div>
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Nome</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden md:table-cell">Contato</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden lg:table-cell">Campanha</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden sm:table-cell">Estimado</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Status</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ações</th>
            </tr></thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{l.nome}</td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell text-xs">{l.telefone || l.email || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">{l.campanha?.nome || l.origem || '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-600 hidden sm:table-cell num">{l.valor_estimado ? brl(l.valor_estimado) : '—'}</td>
                  <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${CHIP[l.status]}`}>{STATUS[l.status]}</span></td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {['novo', 'contatado', 'qualificado'].includes(l.status) && (
                      <button onClick={() => avancar(l)} title="Avançar etapa" className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-100 rounded"><ChevronRight className="w-4 h-4" /></button>
                    )}
                    <button onClick={() => openEdit(l)} title="Editar" className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><Pencil className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? 'Editar lead' : 'Novo lead'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-2"><Label>CPF</Label><Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Campanha</Label>
                <Select value={form.campanha_id} onValueChange={(v) => setForm({ ...form, campanha_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{campanhas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Origem</Label><Input value={form.origem} onChange={(e) => setForm({ ...form, origem: e.target.value })} placeholder="indicação, orgânico..." /></div>
              <div className="space-y-2"><Label>Valor estimado</Label><Input type="number" step="0.01" value={form.valor_estimado} onChange={(e) => setForm({ ...form, valor_estimado: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Observação</Label><Textarea rows={2} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} /></div>
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
