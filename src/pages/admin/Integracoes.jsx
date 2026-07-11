import React, { useEffect, useState } from 'react';
import { integracoesApi } from '@/lib/api/expansao';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { dataBR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Pencil, Plus, Plug } from 'lucide-react';

const CORES = { ativo: 'bg-green-50 text-green-700', inativo: 'bg-slate-100 text-slate-500', erro: 'bg-red-50 text-red-700' };

export default function Integracoes() {
  const { isAdmin } = useAuth();
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ nome: '', tipo: '', status: 'inativo', observacao: '' });

  const load = async () => { setLoading(true); setItens(await integracoesApi.list().catch(() => [])); setLoading(false); };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEdit(null); setForm({ nome: '', tipo: '', status: 'inativo', observacao: '' }); setOpen(true); };
  const openEdit = (i) => { setEdit(i); setForm({ nome: i.nome, tipo: i.tipo || '', status: i.status, observacao: i.observacao || '' }); setOpen(true); };
  const handleSave = async (e) => {
    e.preventDefault();
    const payload = { nome: form.nome, tipo: form.tipo || null, status: form.status, observacao: form.observacao || null };
    try {
      if (edit) { await integracoesApi.update(edit.id, payload); await auditoriaApi.log('editar_integracao', 'integracoes', edit.id, { status: form.status }); }
      else { await integracoesApi.create(payload); await auditoriaApi.log('criar_integracao', 'integracoes', null, {}); }
      setOpen(false); load();
    } catch (err) { alert(err.message || 'Falha ao salvar.'); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Integrações & Portais</h1>
          <p className="text-sm text-slate-500 mt-1">Status das integrações externas (UY3, FIDC, mensageria, notificação)</p>
        </div>
        {isAdmin && <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Nova</Button>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <p className="text-sm text-slate-400">Carregando...</p>
        : itens.map((i) => (
          <div key={i.id} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Plug className="w-4 h-4" /></span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{i.nome}</p>
                  <p className="text-[11px] text-slate-400">{i.tipo || '—'}</p>
                </div>
              </div>
              {isAdmin && <button onClick={() => openEdit(i)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><Pencil className="w-4 h-4" /></button>}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${CORES[i.status] || CORES.inativo}`}>{i.status}</span>
              <span className="text-[11px] text-slate-400">{i.ultima_sincronizacao ? `sync ${dataBR(i.ultima_sincronizacao)}` : 'sem sync'}</span>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? 'Editar integração' : 'Nova integração'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Tipo</Label><Input value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} placeholder="ccb, fidc, mensageria..." /></div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="inativo">Inativo</SelectItem><SelectItem value="erro">Erro</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Observação</Label><Input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} /></div>
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
