import React, { useEffect, useState } from 'react';
import { areasApi } from '@/lib/api/areas';
import { auditoriaApi } from '@/lib/api/auditoria';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';

export default function Areas() {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editArea, setEditArea] = useState(null);
  const [form, setForm] = useState({ nome: '', slug: '', descricao: '', ordem: 0, ativo: true });

  const load = async () => {
    setLoading(true);
    const data = await areasApi.list().catch(() => []);
    setAreas(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditArea(null);
    setForm({ nome: '', slug: '', descricao: '', ordem: areas.length + 1, ativo: true });
    setDialogOpen(true);
  };

  const openEdit = (a) => {
    setEditArea(a);
    setForm({ nome: a.nome, slug: a.slug, descricao: a.descricao || '', ordem: a.ordem, ativo: a.ativo });
    setDialogOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (editArea) {
      await areasApi.update(editArea.id, form);
      await auditoriaApi.log('editar_area', 'areas', editArea.id, { nome: form.nome });
    } else {
      await areasApi.create(form);
      await auditoriaApi.log('criar_area', 'areas', null, { nome: form.nome });
    }
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (a) => {
    if (!confirm(`Remover a área "${a.nome}"?`)) return;
    await areasApi.remove(a.id);
    await auditoriaApi.log('remover_area', 'areas', a.id, { nome: a.nome });
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Áreas</h1>
          <p className="text-sm text-slate-500 mt-1">Áreas e etapas do processo de crédito consignado</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> Nova área
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">Carregando...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ordem</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden md:table-cell">Slug</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden lg:table-cell">Descrição</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Status</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ações</th>
              </tr>
            </thead>
            <tbody>
              {areas.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{a.ordem}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{a.nome}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs hidden md:table-cell">{a.slug}</td>
                  <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">{a.descricao || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${a.ativo ? 'text-green-700' : 'text-slate-400'}`}>
                      {a.ativo ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(a)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(a)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editArea ? 'Editar área' : 'Nova área'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="ex: convenios" required />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ordem</Label>
                <Input type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="flex items-center justify-between pt-6">
                <Label htmlFor="a-ativo">Ativa</Label>
                <Switch id="a-ativo" checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">{editArea ? 'Salvar' : 'Criar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}