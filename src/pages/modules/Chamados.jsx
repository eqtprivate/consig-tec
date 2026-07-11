import React, { useEffect, useState } from 'react';
import { chamadosApi } from '@/lib/api/operacional';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { dataBR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil } from 'lucide-react';

const TIPO = { chamado: 'Chamado', inconsistencia: 'Inconsistência', lgpd: 'LGPD' };
const STATUS = { aberto: 'Aberto', em_andamento: 'Em andamento', resolvido: 'Resolvido', fechado: 'Fechado' };
const CORES = { aberto: 'bg-amber-50 text-amber-700', em_andamento: 'bg-blue-50 text-blue-700', resolvido: 'bg-green-50 text-green-700', fechado: 'bg-slate-100 text-slate-500' };
const PRIOR = { baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' };

// tiposPermitidos: restringe os tipos oferecidos (ex.: suporte usa chamado/inconsistencia)
export default function Chamados({ tiposPermitidos = ['chamado', 'inconsistencia'] }) {
  const { activeUnidade } = useAuth();
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const empty = { tipo: tiposPermitidos[0], categoria: '', assunto: '', descricao: '', status: 'aberto', prioridade: 'media', solicitante_nome: '', solicitante_email: '' };
  const [form, setForm] = useState(empty);

  const load = async () => { setLoading(true); setItens(await chamadosApi.list().catch(() => [])); setLoading(false); };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEdit(null); setForm(empty); setOpen(true); };
  const openEdit = (c) => {
    setEdit(c);
    setForm({ tipo: c.tipo, categoria: c.categoria || '', assunto: c.assunto, descricao: c.descricao || '', status: c.status, prioridade: c.prioridade || 'media', solicitante_nome: c.solicitante_nome || '', solicitante_email: c.solicitante_email || '' });
    setOpen(true);
  };
  const handleSave = async (e) => {
    e.preventDefault();
    const payload = { tipo: form.tipo, categoria: form.categoria || null, assunto: form.assunto, descricao: form.descricao || null, status: form.status, prioridade: form.prioridade, solicitante_nome: form.solicitante_nome || null, solicitante_email: form.solicitante_email || null };
    try {
      if (edit) { await chamadosApi.update(edit.id, payload); await auditoriaApi.log('editar_chamado', 'chamados', edit.id, { status: form.status }); }
      else { await chamadosApi.create({ ...payload, franquia_id: activeUnidade?.id || null }); await auditoriaApi.log('criar_chamado', 'chamados', null, {}); }
      setOpen(false); load();
    } catch (err) { alert(err.message || 'Falha ao salvar.'); }
  };

  const visiveis = itens.filter((c) => tiposPermitidos.includes(c.tipo));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Chamados e inconsistências</p>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Novo</Button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-12 text-center text-sm text-slate-400">Carregando...</div>
        : visiveis.length === 0 ? <div className="p-12 text-center text-sm text-slate-400">Nenhum chamado.</div>
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Assunto</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden sm:table-cell">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden md:table-cell">Prioridade</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden lg:table-cell">Aberto</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Status</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ações</th>
            </tr></thead>
            <tbody>
              {visiveis.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{c.assunto}</td>
                  <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">{TIPO[c.tipo]}</td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{PRIOR[c.prioridade] || c.prioridade}</td>
                  <td className="px-4 py-3 text-right text-slate-600 hidden lg:table-cell">{dataBR(c.created_at)}</td>
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
          <DialogHeader><DialogTitle>{edit ? 'Editar chamado' : 'Novo chamado'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{tiposPermitidos.map((t) => <SelectItem key={t} value={t}>{TIPO[t]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Categoria</Label><Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Assunto</Label><Input value={form.assunto} onChange={(e) => setForm({ ...form, assunto: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PRIOR).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
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
              <div className="space-y-2"><Label>Solicitante</Label><Input value={form.solicitante_nome} onChange={(e) => setForm({ ...form, solicitante_nome: e.target.value })} /></div>
              <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={form.solicitante_email} onChange={(e) => setForm({ ...form, solicitante_email: e.target.value })} /></div>
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
