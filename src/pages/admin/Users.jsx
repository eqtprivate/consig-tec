import React, { useEffect, useState } from 'react';
import { usuariosApi } from '@/lib/api/usuarios';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { validarSenha } from '@/lib/validators';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Trash2, Pencil, ShieldCheck, ShieldAlert, Plus, KeyRound, Power, Copy } from 'lucide-react';

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
  const [createForm, setCreateForm] = useState({ nome: '', email: '', password: '', role: 'usuario', gerarSenha: true });
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [senhaGerada, setSenhaGerada] = useState(null); // { email, senha }

  const rolesDisponiveis = isSuperadmin ? ['usuario', 'admin', 'superadmin'] : ['usuario'];

  const load = async () => {
    setLoading(true);
    setUsuarios(await usuariosApi.list().catch(() => []));
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
    setCreateForm({ nome: '', email: '', password: '', role: 'usuario', gerarSenha: true });
    setCreateOpen(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setErro('');
    if (!createForm.gerarSenha) {
      const problema = validarSenha(createForm.password);
      if (problema) return setErro(problema);
    }
    setSaving(true);
    try {
      const res = await usuariosApi.criar(createForm);
      await auditoriaApi.log('criar_usuario', 'usuarios', null, { email: createForm.email, role: createForm.role });
      setCreateOpen(false);
      if (res?.senha) setSenhaGerada({ email: res.email, senha: res.senha });
      load();
    } catch (err) {
      setErro(err.message || 'Falha ao criar usuário');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (u) => {
    if (!confirm(`Resetar a senha de "${u.nome}"? Será gerada uma senha temporária.`)) return;
    try {
      const res = await usuariosApi.adminAction('reset_senha', u.id);
      await auditoriaApi.log('reset_senha', 'usuarios', u.id, { nome: u.nome });
      if (res?.senha) setSenhaGerada({ email: u.email, senha: res.senha });
    } catch (err) { alert(err.message); }
  };

  const handleToggleAtivo = async (u) => {
    try {
      await usuariosApi.adminAction(u.ativo ? 'desativar' : 'ativar', u.id);
      await auditoriaApi.log(u.ativo ? 'desativar_usuario' : 'ativar_usuario', 'usuarios', u.id, { nome: u.nome });
      load();
    } catch (err) { alert(err.message); }
  };

  const handleDelete = async (u) => {
    if (!confirm(`Excluir "${u.nome}" definitivamente? A conta de acesso será removida.`)) return;
    try {
      await usuariosApi.adminAction('excluir', u.id);
      await auditoriaApi.log('excluir_usuario', 'usuarios', u.id, { nome: u.nome });
      load();
    } catch (err) { alert(err.message); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Usuários</h1>
          <p className="text-sm text-slate-500 mt-1">Gestão de usuários, papéis e acessos</p>
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
              {usuarios.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
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
                        <button title="Editar" onClick={() => openEdit(u)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><Pencil className="w-4 h-4" /></button>
                        <button title="Resetar senha" onClick={() => handleReset(u)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded"><KeyRound className="w-4 h-4" /></button>
                        {!isSelf && (
                          <button title={u.ativo ? 'Desativar' : 'Ativar'} onClick={() => handleToggleAtivo(u)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><Power className="w-4 h-4" /></button>
                        )}
                        {!isSelf && (
                          <button title="Excluir" onClick={() => handleDelete(u)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
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
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} required />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
              <Label htmlFor="gerar" className="cursor-pointer">Gerar senha temporária</Label>
              <Switch id="gerar" checked={createForm.gerarSenha} onCheckedChange={(v) => setCreateForm({ ...createForm, gerarSenha: v })} />
            </div>
            {!createForm.gerarSenha && (
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input type="text" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} placeholder="mín. 8 caracteres, com letra e número" />
              </div>
            )}
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

      {/* Senha temporária gerada */}
      <Dialog open={!!senhaGerada} onOpenChange={(v) => !v && setSenhaGerada(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Senha temporária</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Repasse ao usuário. Ele será obrigado a trocá-la no primeiro acesso.</p>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <p className="text-xs text-slate-500">{senhaGerada?.email}</p>
              <div className="flex items-center justify-between gap-2 mt-1">
                <code className="font-mono text-sm text-slate-900">{senhaGerada?.senha}</code>
                <button onClick={() => navigator.clipboard?.writeText(senhaGerada?.senha || '')} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded" title="Copiar"><Copy className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setSenhaGerada(null)}>Fechar</Button>
          </DialogFooter>
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
