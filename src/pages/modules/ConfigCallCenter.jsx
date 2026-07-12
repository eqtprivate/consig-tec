import React, { useEffect, useState } from 'react';
import { motivosPerdaApi, roteiroApi } from '@/lib/api/crm';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const CATEGORIAS = ['abordagem', 'sondagem', 'oferta', 'objecoes', 'fechamento'];

function MotivosSection() {
  const [itens, setItens] = useState([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ codigo: '', nome: '', ordem: '0', ativo: true });
  const load = async () => setItens(await motivosPerdaApi.listAll().catch(() => []));
  useEffect(() => { load(); }, []);
  const openCreate = () => { setEdit(null); setForm({ codigo: '', nome: '', ordem: '0', ativo: true }); setOpen(true); };
  const openEdit = (m) => { setEdit(m); setForm({ codigo: m.codigo || '', nome: m.nome, ordem: String(m.ordem ?? 0), ativo: m.ativo }); setOpen(true); };
  const save = async (e) => {
    e.preventDefault();
    const payload = { codigo: form.codigo || null, nome: form.nome, ordem: Number(form.ordem) || 0, ativo: form.ativo };
    try {
      if (edit) await motivosPerdaApi.update(edit.id, payload); else await motivosPerdaApi.create(payload);
      await auditoriaApi.log(edit ? 'editar_motivo' : 'criar_motivo', 'motivos_perda', edit?.id || null, {});
      setOpen(false); load();
    } catch (err) { alert(err.message); }
  };
  const remove = async (m) => { if (!confirm(`Remover "${m.nome}"?`)) return; try { await motivosPerdaApi.remove(m.id); load(); } catch (err) { alert(err.message); } };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-800">Motivos de perda</h3>
        <Button size="sm" onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Novo</Button>
      </div>
      <div className="space-y-1">
        {itens.map((m) => (
          <div key={m.id} className="flex items-center justify-between border border-slate-100 rounded px-3 py-1.5">
            <span className="text-sm text-slate-700">{m.nome} {!m.ativo && <span className="text-xs text-slate-400">(inativo)</span>}</span>
            <div className="flex gap-1">
              <button onClick={() => openEdit(m)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => remove(m)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? 'Editar motivo' : 'Novo motivo'}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2 col-span-2"><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Ordem</Label><Input type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Código</Label><Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="ex: sem_margem" /></div>
            <div className="flex items-center justify-between"><Label>Ativo</Label><Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} /></div>
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

function RoteiroSection() {
  const [itens, setItens] = useState([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ categoria: 'abordagem', titulo: '', conteudo: '', ordem: '0', ativo: true });
  const load = async () => setItens(await roteiroApi.listAll().catch(() => []));
  useEffect(() => { load(); }, []);
  const openCreate = () => { setEdit(null); setForm({ categoria: 'abordagem', titulo: '', conteudo: '', ordem: '0', ativo: true }); setOpen(true); };
  const openEdit = (r) => { setEdit(r); setForm({ categoria: r.categoria, titulo: r.titulo, conteudo: r.conteudo, ordem: String(r.ordem ?? 0), ativo: r.ativo }); setOpen(true); };
  const save = async (e) => {
    e.preventDefault();
    const payload = { categoria: form.categoria, titulo: form.titulo, conteudo: form.conteudo, ordem: Number(form.ordem) || 0, ativo: form.ativo };
    try {
      if (edit) await roteiroApi.update(edit.id, payload); else await roteiroApi.create(payload);
      await auditoriaApi.log(edit ? 'editar_roteiro' : 'criar_roteiro', 'roteiro_scripts', edit?.id || null, {});
      setOpen(false); load();
    } catch (err) { alert(err.message); }
  };
  const remove = async (r) => { if (!confirm('Remover este passo?')) return; try { await roteiroApi.remove(r.id); load(); } catch (err) { alert(err.message); } };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-800">Roteiro de atendimento</h3>
        <Button size="sm" onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Novo passo</Button>
      </div>
      <div className="space-y-1">
        {itens.map((r) => (
          <div key={r.id} className="flex items-start justify-between border border-slate-100 rounded px-3 py-1.5">
            <div className="min-w-0">
              <p className="text-sm text-slate-700"><span className="text-[10px] uppercase text-slate-400 mr-2">{r.categoria}</span>{r.titulo}</p>
              <p className="text-xs text-slate-400 truncate">{r.conteudo}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => openEdit(r)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => remove(r)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? 'Editar passo' : 'Novo passo'}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2 col-span-2">
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Ordem</Label><Input type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Título</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Conteúdo</Label><Textarea rows={3} value={form.conteudo} onChange={(e) => setForm({ ...form, conteudo: e.target.value })} placeholder="Use {NOME}, {VALOR}, {PARCELA} para personalizar" required /></div>
            <div className="flex items-center justify-between"><Label>Ativo</Label><Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} /></div>
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

export default function ConfigCallCenter() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <p className="text-sm text-slate-500">Configuração restrita a administradores do grupo.</p>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Configuração do call center — roteiro de atendimento e motivos de perda</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RoteiroSection />
        <MotivosSection />
      </div>
    </div>
  );
}
