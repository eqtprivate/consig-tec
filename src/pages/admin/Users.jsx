import React, { useEffect, useState } from 'react';
import { usuariosApi } from '@/lib/api/usuarios';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Trash2, Pencil, ShieldCheck, ShieldAlert } from 'lucide-react';

export default function Users() {
  const { perfil: currentUser } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ nome: '', cpf: '', is_grupo_admin: false, ativo: true });

  const load = async () => {
    setLoading(true);
    const data = await usuariosApi.list().catch(() => []);
    setUsuarios(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEdit = (u) => {
    setEditUser(u);
    setForm({ nome: u.nome, cpf: u.cpf || '', is_grupo_admin: !!u.is_grupo_admin, ativo: u.ativo });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    await usuariosApi.update(editUser.id, form);
    await auditoriaApi.log('editar_usuario', 'usuarios', editUser.id, { nome: form.nome });
    setEditUser(null);
    load();
  };

  const handleDelete = async (u) => {
    if (!confirm(`Remover o usuário "${u.nome}"? Esta ação não pode ser desfeita.`)) return;
    await usuariosApi.remove(u.id);
    await auditoriaApi.log('remover_usuario', 'usuarios', u.id, { nome: u.nome });
    load();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Usuários</h1>
        <p className="text-sm text-slate-500 mt-1">Gestão de usuários do sistema. Novos usuários são criados via Supabase Auth.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">Carregando...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden md:table-cell">E-mail</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden lg:table-cell">CPF</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Status</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{u.nome}</td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{u.email}</td>
                  <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">{u.cpf || '—'}</td>
                  <td className="px-4 py-3">
                    {u.ativo ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700"><ShieldCheck className="w-3 h-3" /> Ativo</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400"><ShieldAlert className="w-3 h-3" /> Inativo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(u)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded">
                        <Pencil className="w-4 h-4" />
                      </button>
                      {u.id !== currentUser?.id && (
                        <button onClick={() => handleDelete(u)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={!!editUser} onOpenChange={(v) => !v && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="is-admin">Admin do grupo</Label>
              <Switch id="is-admin" checked={form.is_grupo_admin} onCheckedChange={(v) => setForm({ ...form, is_grupo_admin: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="ativo">Usuário ativo</Label>
              <Switch id="ativo" checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}