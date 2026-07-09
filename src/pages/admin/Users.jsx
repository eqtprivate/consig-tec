import React, { useEffect, useState } from 'react';
import { usuariosApi } from '@/lib/api/usuarios';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Trash2, Pencil, ShieldCheck, ShieldAlert, Plus } from 'lucide-react';

const ROLE_LABELS = { usuario: 'Usuário', admin: 'Admin', superadmin: 'Superadmin' };
const ROLE_CORES = {
  usuario: 'bg-slate-100 text-slate-600',
  admin: 'bg-blue-50 text-blue-700',
  superadmin: 'bg-violet-50 text-violet-700',
};

export default function Users() {
  const { perfil: currentUser, isSuperadmin } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ nome: '', cpf: '', role: 'usuario', ativo: true });

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ nome: '', email: '', password: '', role: 'usuario' });
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');

  // Papéis que o usuário atual pode atribuir
  const rolesDisponiveis = isSuperadmin ? ['usuario', 'admin', 'superadmin'] : ['usuario'];

  const load = async () => {
    setLoading(true);
    const data = await usuariosApi.list().catch(() => []);
    setUsuarios(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEdit = (u) => {
    setEditUser(u);
    setForm({ nome: u.nome, cpf: u.cpf || '', role: u.role || 'usuario', ativo: u.ativo });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const updates = { nome: form.nome, cpf: form.cpf || null, ativo: form.ativo };
    // Só superadmin altera role; ao alterar, mantém is_grupo_admin coerente
    if (isSuperadmin) {
      updates.role = form.role;
      updates.is_grupo_admin = form.role !== 'usuario';
    }
    await usuariosApi.update(editUser.id, updates);
    await auditoriaApi.log('editar_usuario', 'usuarios', editUser.id, { nome: form.nome, role: updates.role });
    setEditUser(null);
    load();
  };

  const openCreate = () => {
    setErro('');
    setCreateForm({ nome: '', email: '', password: '', role: 'usuario' });
    setCreateOpen(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setErro('');
    setSaving(true);
    try {
      await usuariosApi.criar(createForm);
      await auditoriaApi.log('criar_usuario', 'usuarios', null, { email: createForm.email, role: createForm.role });
      setCreateOpen(false);
      load();
    } catch (err) {
      setErro(err.message || 'Falha ao criar usuário');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u) => {
    if (!confirm(`Remover o perfil de "${u.nome}"?`)) return;
    await usuariosApi.remove(u.id);
    await auditoriaApi.log('remover_usuario', 'usuarios', u.id, { nome: u.nome });
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Usuários</h1>
          <p className="text-sm text-slate-500 mt-1">Gestão de usuários e papéis de acesso</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Novo usuário</Button>
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
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Papel</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Status</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{u.nome}</td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ROLE_CORES[u.role] || ROLE_CORES.usuario}`}>
                      {ROLE_LABELS[u.role] || 'Usuário'}
                    </span>
                  </td>
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

      {/* Criar usuário */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            {erro && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{erro}</div>}
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={createForm.nome} onChange={(e) => setCreateForm({ ...createForm, nome: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input type="text" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} required minLength={6} placeholder="mín. 6 caracteres" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select value={createForm.role} onValueChange={(v) => setCreateForm({ ...createForm, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {rolesDisponiveis.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                </SelectContent>
              </Select>
              {!isSuperadmin && <p className="text-xs text-slate-400">Apenas superadmins podem criar admins/superadmins.</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Criando…' : 'Criar usuário'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Editar usuário */}
      <Dialog open={!!editUser} onOpenChange={(v) => !v && setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar usuário</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })} disabled={!isSuperadmin}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(isSuperadmin ? ['usuario', 'admin', 'superadmin'] : [form.role]).map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r] || r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isSuperadmin && <p className="text-xs text-slate-400">Somente superadmins alteram papéis.</p>}
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
