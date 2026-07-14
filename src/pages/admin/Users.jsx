import React, { useEffect, useState } from 'react';
import { usuariosApi } from '@/lib/api/usuarios';
import { vinculosApi } from '@/lib/api/vinculos';
import { franquiasApi } from '@/lib/api/franquias';
import { areasApi } from '@/lib/api/areas';
import { papeisApi } from '@/lib/api/papeis';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { validarSenha } from '@/lib/validators';
import { toast } from 'sonner';
import { confirmar } from '@/lib/confirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Trash2, Pencil, ShieldCheck, ShieldAlert, Plus, KeyRound, Power, Copy, Link2, Mail } from 'lucide-react';
import { PageHeader, StatusBadge, EmptyState } from '@/components/kit';

const ROLE_LABELS = { usuario: 'Usuário', admin: 'Admin', superadmin: 'Superadmin' };
const ROLE_CORES = {
  usuario: 'bg-muted text-muted-foreground',
  admin: 'bg-blue-50 text-blue-700',
  superadmin: 'bg-violet-50 text-violet-700',
};

export default function Users() {
  const { perfil: currentUser, isSuperadmin, planoUso, empresaView } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ nome: '', cpf: '', role: 'usuario', ativo: true });

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ nome: '', email: '', password: '', role: 'usuario', gerarSenha: true, enviarEmail: true });
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [senhaGerada, setSenhaGerada] = useState(null); // { email, senha, emailEnviado }

  // Gestão de acessos (vínculos) por usuário
  const [acessosUser, setAcessosUser] = useState(null);
  const [acessos, setAcessos] = useState([]);
  const [franquias, setFranquias] = useState([]);
  const [areas, setAreas] = useState([]);
  const [papeis, setPapeis] = useState([]);
  const [vincForm, setVincForm] = useState({ franquia_id: '', area_id: '', papel_id: '' });
  const [savingVinc, setSavingVinc] = useState(false);

  const rolesDisponiveis = isSuperadmin ? ['usuario', 'admin', 'superadmin'] : ['usuario'];

  // Superadmin "ver como" empresa: filtra a lista pela empresa em foco.
  const usuariosView = empresaView ? usuarios.filter((u) => u.empresa_id === empresaView) : usuarios;
  // Limite de usuários do plano (só avisa).
  const limiteUsuarios = planoUso?.plano?.limite_usuarios ?? null;
  const usadosUsuarios = planoUso?.uso?.usuarios ?? usuarios.length;

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
    try {
      const updates = { nome: form.nome, cpf: form.cpf || null };
      if (isSuperadmin) {
        updates.role = form.role;
        updates.is_grupo_admin = form.role !== 'usuario';
      }
      await usuariosApi.update(editUser.id, updates);
      // Ativar/desativar passa pela função (bane/desbane no Auth), não só o flag.
      if (editUser.ativo !== form.ativo) {
        await usuariosApi.adminAction(form.ativo ? 'ativar' : 'desativar', editUser.id);
      }
      await auditoriaApi.log('editar_usuario', 'usuarios', editUser.id, { nome: form.nome, role: updates.role });
      setEditUser(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Não foi possível salvar. Verifique suas permissões.');
    }
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
    // Aviso de limite de plano (não bloqueia).
    if (limiteUsuarios != null && usadosUsuarios + 1 > limiteUsuarios) {
      toast.warning(`Plano ${planoUso?.plano?.nome || ''} permite ${limiteUsuarios} usuário(s); este será o ${usadosUsuarios + 1}º. Considere fazer upgrade.`);
    }
    setSaving(true);
    try {
      const payload = { ...createForm };
      if (isSuperadmin && empresaView) payload.empresa_id = empresaView; // cria na empresa em foco
      const res = await usuariosApi.criar(payload);
      await auditoriaApi.log('criar_usuario', 'usuarios', null, { email: createForm.email, role: createForm.role });
      setCreateOpen(false);
      if (res?.senha) setSenhaGerada({ email: res.email, senha: res.senha, emailEnviado: res.emailEnviado });
      load();
    } catch (err) {
      setErro(err.message || 'Falha ao criar usuário');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (u) => {
    if (!(await confirmar({ title: 'Resetar senha', description: `Gerar senha temporária para "${u.nome}" e enviar por e-mail?`, confirmText: 'Resetar' }))) return;
    try {
      const res = await usuariosApi.adminAction('reset_senha', u.id, { enviarEmail: true });
      await auditoriaApi.log('reset_senha', 'usuarios', u.id, { nome: u.nome });
      if (res?.senha) setSenhaGerada({ email: u.email, senha: res.senha, emailEnviado: res.emailEnviado });
    } catch (err) { toast.error(err.message); }
  };

  // ---- Acessos (vínculos) por usuário ----
  const openAcessos = async (u) => {
    setAcessosUser(u);
    setVincForm({ franquia_id: '', area_id: '', papel_id: '' });
    const [v, f, a, p] = await Promise.all([
      vinculosApi.list().catch(() => []),
      franquias.length ? Promise.resolve(franquias) : franquiasApi.list().catch(() => []),
      areas.length ? Promise.resolve(areas) : areasApi.list().catch(() => []),
      papeis.length ? Promise.resolve(papeis) : papeisApi.list().catch(() => []),
    ]);
    setFranquias(f); setAreas(a); setPapeis(p);
    setAcessos(v.filter((x) => x.usuario_id === u.id));
  };
  const reloadAcessos = async () => {
    if (!acessosUser) return;
    const v = await vinculosApi.list().catch(() => []);
    setAcessos(v.filter((x) => x.usuario_id === acessosUser.id));
  };
  const [tipoForm, setTipoForm] = useState({ franquia_id: '', papel_id: '' });
  const [aplicandoTipo, setAplicandoTipo] = useState(false);
  const aplicarTipo = async () => {
    if (!tipoForm.franquia_id || !tipoForm.papel_id) return toast.error('Selecione a franquia e o tipo.');
    setAplicandoTipo(true);
    try {
      const n = await vinculosApi.aplicarTipo(acessosUser.id, tipoForm.franquia_id, tipoForm.papel_id);
      await auditoriaApi.log('aplicar_tipo_usuario', 'vinculos', acessosUser.id, { papel_id: tipoForm.papel_id, criados: n });
      toast.success(n > 0 ? `${n} acesso(s) concedido(s) pelo tipo.` : 'Nenhum acesso novo — o usuário já tinha as áreas do tipo.');
      setTipoForm({ franquia_id: '', papel_id: '' });
      reloadAcessos();
    } catch (err) { toast.error(err.message || 'Falha ao aplicar tipo.'); }
    finally { setAplicandoTipo(false); }
  };
  const papelSel = papeis.find((p) => p.id === tipoForm.papel_id);
  const areasDoTipo = (papelSel?.areas_padrao || []).map((cod) => areas.find((a) => a.codigo === cod)?.nome || cod);

  const addVinculo = async (e) => {
    e.preventDefault();
    if (!vincForm.area_id || !vincForm.papel_id) return toast.error('Selecione área e papel.');
    setSavingVinc(true);
    try {
      await vinculosApi.create({
        usuario_id: acessosUser.id,
        franquia_id: vincForm.franquia_id || null,
        area_id: vincForm.area_id, papel_id: vincForm.papel_id, ativo: true,
      });
      await auditoriaApi.log('criar_vinculo', 'vinculos', null, { usuario_id: acessosUser.id });
      setVincForm({ franquia_id: '', area_id: '', papel_id: '' });
      reloadAcessos();
    } catch (err) { toast.error(err.message || 'Falha ao adicionar acesso.'); }
    finally { setSavingVinc(false); }
  };
  const toggleVinculo = async (v) => {
    await vinculosApi.update(v.id, { ativo: !v.ativo });
    await auditoriaApi.log('editar_vinculo', 'vinculos', v.id, { ativo: !v.ativo });
    reloadAcessos();
  };
  const removeVinculo = async (v) => {
    if (!(await confirmar({ title: 'Remover acesso', description: 'Remover este acesso?', destructive: true, confirmText: 'Remover' }))) return;
    await vinculosApi.remove(v.id);
    await auditoriaApi.log('remover_vinculo', 'vinculos', v.id, {});
    reloadAcessos();
  };

  const handleToggleAtivo = async (u) => {
    try {
      await usuariosApi.adminAction(u.ativo ? 'desativar' : 'ativar', u.id);
      await auditoriaApi.log(u.ativo ? 'desativar_usuario' : 'ativar_usuario', 'usuarios', u.id, { nome: u.nome });
      load();
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async (u) => {
    if (!(await confirmar({ title: 'Excluir usuário', description: `Excluir "${u.nome}" definitivamente? A conta de acesso será removida.`, destructive: true, confirmText: 'Excluir' }))) return;
    try {
      await usuariosApi.adminAction('excluir', u.id);
      await auditoriaApi.log('excluir_usuario', 'usuarios', u.id, { nome: u.nome });
      load();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Usuários"
        subtitle={(
          <>
            Gestão de usuários, papéis e acessos
            {limiteUsuarios != null && (
              <span className={`ml-2 text-xs ${usadosUsuarios >= limiteUsuarios ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
                · {usadosUsuarios}/{limiteUsuarios} do plano{usadosUsuarios >= limiteUsuarios ? ' (no limite)' : ''}
              </span>
            )}
          </>
        )}
        actions={<Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Novo usuário</Button>}
      />

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <EmptyState title="Carregando…" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden md:table-cell">E-mail</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Papel</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuariosView.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <tr key={u.id} className="border-b border-border hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium text-foreground">{u.nome}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{u.email}</td>
                    <td className="px-4 py-3">
                      <StatusBadge className={ROLE_CORES[u.role] || ROLE_CORES.usuario}>
                        {ROLE_LABELS[u.role] || 'Usuário'}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      {u.ativo ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700"><ShieldCheck className="w-3 h-3" /> Ativo</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><ShieldAlert className="w-3 h-3" /> Inativo</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button title="Acessos (vínculos)" onClick={() => openAcessos(u)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted/50 rounded"><Link2 className="w-4 h-4" /></button>
                        <button title="Editar" onClick={() => openEdit(u)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded"><Pencil className="w-4 h-4" /></button>
                        <button title="Resetar senha" onClick={() => handleReset(u)} className="p-1.5 text-muted-foreground hover:text-amber-600 hover:bg-amber-50 rounded"><KeyRound className="w-4 h-4" /></button>
                        {!isSelf && (
                          <button title={u.ativo ? 'Desativar' : 'Ativar'} onClick={() => handleToggleAtivo(u)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded"><Power className="w-4 h-4" /></button>
                        )}
                        {!isSelf && (
                          <button title="Excluir" onClick={() => handleDelete(u)} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
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
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <Label htmlFor="gerar" className="cursor-pointer">Gerar senha temporária</Label>
              <Switch id="gerar" checked={createForm.gerarSenha} onCheckedChange={(v) => setCreateForm({ ...createForm, gerarSenha: v })} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <Label htmlFor="enviar" className="cursor-pointer flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" /> Enviar senha por e-mail</Label>
              <Switch id="enviar" checked={createForm.enviarEmail} onCheckedChange={(v) => setCreateForm({ ...createForm, enviarEmail: v })} />
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
              {!isSuperadmin && <p className="text-xs text-muted-foreground">Apenas superadmins podem criar admins/superadmins.</p>}
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
            {senhaGerada?.emailEnviado
              ? <p className="text-sm text-green-700 flex items-center gap-2"><Mail className="w-4 h-4" /> Enviada por e-mail para o usuário. Guarde a cópia abaixo como backup.</p>
              : <p className="text-sm text-muted-foreground">Repasse ao usuário (o envio por e-mail não foi feito ou falhou). Ele será obrigado a trocá-la no primeiro acesso.</p>}
            <div className="rounded-lg bg-muted border border-border p-3">
              <p className="text-xs text-muted-foreground">{senhaGerada?.email}</p>
              <div className="flex items-center justify-between gap-2 mt-1">
                <code className="font-mono text-sm text-foreground">{senhaGerada?.senha}</code>
                <button onClick={() => navigator.clipboard?.writeText(senhaGerada?.senha || '')} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded" title="Copiar"><Copy className="w-4 h-4" /></button>
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
              {!isSuperadmin && <p className="text-xs text-muted-foreground">Somente superadmins alteram papéis.</p>}
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

      {/* Acessos (vínculos) do usuário */}
      <Dialog open={!!acessosUser} onOpenChange={(v) => !v && setAcessosUser(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Acessos — {acessosUser?.nome}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            Papel global: <span className="font-medium">{ROLE_LABELS[acessosUser?.role] || 'Usuário'}</span>. Abaixo, os vínculos (franquia × área × papel) que definem o acesso operacional por área.
          </p>

          <div className="space-y-2 max-h-56 overflow-y-auto">
            {acessos.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Nenhum vínculo. {acessosUser?.role === 'usuario' ? 'Sem vínculos, este usuário não acessa áreas operacionais.' : ''}</p>
            ) : acessos.map((v) => (
              <div key={v.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {v.area?.nome || '—'} <span className="text-xs text-muted-foreground">· {v.papel?.nome || '—'}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{v.franquia?.nome || 'Sem franquia'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs ${v.ativo ? 'text-green-700' : 'text-muted-foreground'}`}>{v.ativo ? 'Ativo' : 'Inativo'}</span>
                  <button onClick={() => toggleVinculo(v)} title={v.ativo ? 'Desativar' : 'Ativar'} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded"><Power className="w-3.5 h-3.5" /></button>
                  <button onClick={() => removeVinculo(v)} title="Remover" className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aplicar tipo (papel padrão)</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Franquia</Label>
                <Select value={tipoForm.franquia_id} onValueChange={(v) => setTipoForm({ ...tipoForm, franquia_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{franquias.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de usuário</Label>
                <Select value={tipoForm.papel_id} onValueChange={(v) => setTipoForm({ ...tipoForm, papel_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{papeis.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="button" onClick={aplicarTipo} disabled={aplicandoTipo} className="w-full gap-2"><ShieldCheck className="w-4 h-4" /> {aplicandoTipo ? 'Aplicando…' : 'Aplicar tipo'}</Button>
              </div>
            </div>
            {areasDoTipo.length > 0 && (
              <p className="text-[11px] text-muted-foreground">Concede acesso a: <b className="text-foreground">{areasDoTipo.join(', ')}</b></p>
            )}
          </div>

          <form onSubmit={addVinculo} className="border-t border-border pt-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conceder acesso avulso</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Franquia</Label>
                <Select value={vincForm.franquia_id} onValueChange={(v) => setVincForm({ ...vincForm, franquia_id: v })}>
                  <SelectTrigger><SelectValue placeholder="(opcional)" /></SelectTrigger>
                  <SelectContent>{franquias.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Área</Label>
                <Select value={vincForm.area_id} onValueChange={(v) => setVincForm({ ...vincForm, area_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Papel</Label>
                <Select value={vincForm.papel_id} onValueChange={(v) => setVincForm({ ...vincForm, papel_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{papeis.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={savingVinc} className="gap-2"><Plus className="w-4 h-4" /> {savingVinc ? 'Adicionando…' : 'Conceder'}</Button>
            </div>
          </form>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAcessosUser(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
