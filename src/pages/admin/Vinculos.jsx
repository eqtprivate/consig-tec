import React, { useEffect, useState } from 'react';
import { vinculosApi } from '@/lib/api/vinculos';
import { usuariosApi } from '@/lib/api/usuarios';
import { unidadesApi } from '@/lib/api/unidades';
import { areasApi } from '@/lib/api/areas';
import { auditoriaApi } from '@/lib/api/auditoria';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const PAPEIS = [
  { value: 'admin', label: 'Admin' },
  { value: 'diretor_area', label: 'Diretor de Área' },
  { value: 'lider', label: 'Líder' },
  { value: 'corban', label: 'Corban' },
  { value: 'operador', label: 'Operador' },
  { value: 'suporte', label: 'Suporte' },
];

export default function Vinculos() {
  const [vinculos, setVinculos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editVinculo, setEditVinculo] = useState(null);
  const [form, setForm] = useState({ usuario_id: '', unidade_id: '', area_id: '', papel: 'operador', ativo: true });

  const load = async () => {
    setLoading(true);
    const [v, u, un, a] = await Promise.all([
      vinculosApi.list().catch(() => []),
      usuariosApi.list().catch(() => []),
      unidadesApi.list().catch(() => []),
      areasApi.list().catch(() => []),
    ]);
    setVinculos(v);
    setUsuarios(u);
    setUnidades(un);
    setAreas(a);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditVinculo(null);
    setForm({ usuario_id: '', unidade_id: '', area_id: '', papel: 'operador', ativo: true });
    setDialogOpen(true);
  };

  const openEdit = (v) => {
    setEditVinculo(v);
    setForm({ usuario_id: v.usuario_id, unidade_id: v.unidade_id, area_id: v.area_id, papel: v.papel, ativo: v.ativo });
    setDialogOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (editVinculo) {
      await vinculosApi.update(editVinculo.id, form);
      await auditoriaApi.log('editar_vinculo', 'vinculos', editVinculo.id, form);
    } else {
      await vinculosApi.create(form);
      await auditoriaApi.log('criar_vinculo', 'vinculos', null, form);
    }
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (v) => {
    if (!confirm('Remover este vínculo?')) return;
    await vinculosApi.remove(v.id);
    await auditoriaApi.log('remover_vinculo', 'vinculos', v.id, {});
    load();
  };

  const getNome = (list, id, field) => list.find((x) => x.id === id)?.[field] || '—';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vínculos</h1>
          <p className="text-sm text-slate-500 mt-1">Gestão de vínculos: usuário × unidade × área × papel</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> Novo vínculo
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">Carregando...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Usuário</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden md:table-cell">Unidade</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden lg:table-cell">Área</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Papel</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Status</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ações</th>
              </tr>
            </thead>
            <tbody>
              {vinculos.map((v) => (
                <tr key={v.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{v.usuario?.nome || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{v.unidade?.nome || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">{v.area?.nome || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                      {PAPEIS.find((p) => p.value === v.papel)?.label || v.papel}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${v.ativo ? 'text-green-700' : 'text-slate-400'}`}>
                      {v.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(v)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(v)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
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
            <DialogTitle>{editVinculo ? 'Editar vínculo' : 'Novo vínculo'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Usuário</Label>
              <Select value={form.usuario_id} onValueChange={(v) => setForm({ ...form, usuario_id: v })} disabled={!!editVinculo}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Select value={form.unidade_id} onValueChange={(v) => setForm({ ...form, unidade_id: v })} disabled={!!editVinculo}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Área</Label>
              <Select value={form.area_id} onValueChange={(v) => setForm({ ...form, area_id: v })} disabled={!!editVinculo}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select value={form.papel} onValueChange={(v) => setForm({ ...form, papel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAPEIS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="v-ativo">Vínculo ativo</Label>
              <Switch id="v-ativo" checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">{editVinculo ? 'Salvar' : 'Criar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}