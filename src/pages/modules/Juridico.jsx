import React, { useEffect, useState } from 'react';
import { lgpdApi } from '@/lib/api/operacional';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { dataBR } from '@/lib/format';
import Chamados from '@/pages/modules/Chamados';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil } from 'lucide-react';

const TIPO = { acesso: 'Acesso', correcao: 'Correção', exclusao: 'Exclusão', portabilidade: 'Portabilidade', revogacao: 'Revogação', oposicao: 'Oposição' };
const STATUS = { recebida: 'Recebida', em_analise: 'Em análise', atendida: 'Atendida', recusada: 'Recusada' };
const CORES = { recebida: 'bg-amber-50 text-amber-700', em_analise: 'bg-blue-50 text-blue-700', atendida: 'bg-green-50 text-green-700', recusada: 'bg-red-50 text-red-700' };

function LgpdTab() {
  const { isAdmin } = useAuth();
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const empty = { titular_nome: '', titular_cpf: '', titular_email: '', tipo: 'acesso', status: 'recebida', descricao: '', prazo_limite: '' };
  const [form, setForm] = useState(empty);

  const load = async () => { setLoading(true); setItens(await lgpdApi.list().catch(() => [])); setLoading(false); };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEdit(null); setForm(empty); setOpen(true); };
  const openEdit = (s) => {
    setEdit(s);
    setForm({ titular_nome: s.titular_nome, titular_cpf: s.titular_cpf || '', titular_email: s.titular_email || '', tipo: s.tipo, status: s.status, descricao: s.descricao || '', prazo_limite: s.prazo_limite || '' });
    setOpen(true);
  };
  const handleSave = async (e) => {
    e.preventDefault();
    const payload = { titular_nome: form.titular_nome, titular_cpf: form.titular_cpf || null, titular_email: form.titular_email || null, tipo: form.tipo, status: form.status, descricao: form.descricao || null, prazo_limite: form.prazo_limite || null, atendida_em: form.status === 'atendida' ? new Date().toISOString() : null };
    try {
      if (edit) { await lgpdApi.update(edit.id, payload); await auditoriaApi.log('editar_lgpd', 'lgpd_solicitacoes', edit.id, { status: form.status }); }
      else { await lgpdApi.create(payload); await auditoriaApi.log('criar_lgpd', 'lgpd_solicitacoes', null, {}); }
      setOpen(false); load();
    } catch (err) { alert(err.message || 'Falha ao salvar.'); }
  };

  if (!isAdmin) return <p className="text-sm text-slate-500">As solicitações LGPD são restritas a administradores do grupo.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Solicitações de titular (LGPD) — acesso, correção, exclusão, portabilidade</p>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Nova solicitação</Button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-12 text-center text-sm text-slate-400">Carregando...</div>
        : itens.length === 0 ? <div className="p-12 text-center text-sm text-slate-400">Nenhuma solicitação.</div>
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Titular</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Tipo</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden md:table-cell">Prazo</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Status</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ações</th>
            </tr></thead>
            <tbody>
              {itens.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{s.titular_nome}</td>
                  <td className="px-4 py-3 text-slate-600">{TIPO[s.tipo]}</td>
                  <td className="px-4 py-3 text-right text-slate-600 hidden md:table-cell">{dataBR(s.prazo_limite)}</td>
                  <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${CORES[s.status]}`}>{STATUS[s.status]}</span></td>
                  <td className="px-4 py-3 text-right"><button onClick={() => openEdit(s)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><Pencil className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? 'Editar solicitação' : 'Nova solicitação LGPD'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Titular</Label><Input value={form.titular_nome} onChange={(e) => setForm({ ...form, titular_nome: e.target.value })} required /></div>
              <div className="space-y-2"><Label>CPF</Label><Input value={form.titular_cpf} onChange={(e) => setForm({ ...form, titular_cpf: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={form.titular_email} onChange={(e) => setForm({ ...form, titular_email: e.target.value })} /></div>
              <div className="space-y-2"><Label>Prazo limite</Label><Input type="date" value={form.prazo_limite} onChange={(e) => setForm({ ...form, prazo_limite: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TIPO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
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
            <div className="space-y-2"><Label>Descrição</Label><Textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
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

const TABS = [{ key: 'lgpd', label: 'LGPD — Titular' }, { key: 'chamados', label: 'Chamados jurídicos' }];
export default function Juridico() {
  const [tab, setTab] = useState('lgpd');
  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'lgpd' ? <LgpdTab /> : <Chamados tiposPermitidos={['chamado', 'lgpd']} />}
    </div>
  );
}
