import React, { useState } from 'react';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { usuariosApi } from '@/lib/api/usuarios';
import { supabase } from '@/lib/supabaseClient';
import { validarSenha } from '@/lib/validators';
import PasswordChecklist from '@/components/PasswordChecklist';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader, Panel } from '@/components/kit';
import { UserCog, Save, Lock, ShieldCheck, Building2, Loader2 } from 'lucide-react';

// Máscara leve de CPF só para exibição no input.
const maskCpf = (v) => {
  const d = (v || '').replace(/\D/g, '').slice(0, 11);
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const ROLE_LABEL = { superadmin: 'Superadministrador', admin: 'Administrador', usuario: 'Usuário' };

export default function Perfil() {
  const { perfil, empresa, plano, isSuperadmin, reloadUserData } = useAuth();

  const [nome, setNome] = useState(perfil?.nome || '');
  const [telefone, setTelefone] = useState(perfil?.telefone || '');
  const [cpf, setCpf] = useState(perfil?.cpf ? maskCpf(perfil.cpf) : '');
  const [savingPerfil, setSavingPerfil] = useState(false);

  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [savingSenha, setSavingSenha] = useState(false);

  const salvarPerfil = async (e) => {
    e.preventDefault();
    if (!nome.trim()) { toast.error('O nome é obrigatório.'); return; }
    const cpfDigits = cpf.replace(/\D/g, '');
    if (cpfDigits && cpfDigits.length !== 11) { toast.error('CPF deve ter 11 dígitos.'); return; }
    setSavingPerfil(true);
    try {
      await usuariosApi.atualizarMeuPerfil({ nome: nome.trim(), telefone: telefone.trim(), cpf: cpfDigits });
      await reloadUserData();
      toast.success('Perfil atualizado.');
    } catch (err) { toast.error(err.message || 'Falha ao salvar o perfil.'); }
    finally { setSavingPerfil(false); }
  };

  const trocarSenha = async (e) => {
    e.preventDefault();
    const problema = validarSenha(senha);
    if (problema) { toast.error(problema); return; }
    if (senha !== confirma) { toast.error('As senhas não coincidem.'); return; }
    setSavingSenha(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      try { await supabase.rpc('marcar_senha_trocada'); } catch { /* opcional */ }
      setSenha(''); setConfirma('');
      toast.success('Senha alterada com sucesso.');
    } catch (err) { toast.error(err.message || 'Não foi possível alterar a senha.'); }
    finally { setSavingSenha(false); }
  };

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader title="Meu perfil" subtitle="Seus dados de acesso e conta" icon={UserCog} />

      {/* Identidade / contexto (somente leitura) */}
      <Panel title="Conta" subtitle="Informações definidas pela administração">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">E-mail</p>
            <p className="text-sm font-medium text-foreground break-all">{perfil?.email || '—'}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Perfil de acesso</p>
            <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" /> {ROLE_LABEL[perfil?.role] || perfil?.role || '—'}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Empresa</p>
            <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              {isSuperadmin ? 'CONSIGTEC (acesso global)' : (empresa?.nome || '—')}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Plano</p>
            <p className="text-sm font-medium text-foreground">{plano?.nome || '—'}</p>
          </div>
        </div>
      </Panel>

      {/* Dados pessoais editáveis */}
      <Panel title="Dados pessoais">
        <form onSubmit={salvarPerfil} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome completo</Label>
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tel">Telefone</Label>
              <Input id="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cpf">CPF</Label>
              <Input id="cpf" value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={savingPerfil} className="gap-2">
              {savingPerfil ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar dados
            </Button>
          </div>
        </form>
      </Panel>

      {/* Troca de senha */}
      <Panel title="Segurança" subtitle="Defina uma nova senha de acesso">
        <form onSubmit={trocarSenha} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="s1">Nova senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="s1" type="password" autoComplete="new-password" className="pl-10" value={senha} onChange={(e) => setSenha(e.target.value)} />
              </div>
              <p className="text-[11px] text-muted-foreground">Mínimo 8 caracteres, com letra e número.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s2">Confirmar nova senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="s2" type="password" autoComplete="new-password" className="pl-10" value={confirma} onChange={(e) => setConfirma(e.target.value)} />
              </div>
            </div>
          </div>
          {senha && (
            <div className="rounded-lg bg-muted/50 border border-border p-3">
              <PasswordChecklist senha={senha} confirma={confirma} />
            </div>
          )}
          <div className="flex justify-end">
            <Button type="submit" variant="outline" disabled={savingSenha || !senha || !!validarSenha(senha) || senha !== confirma} className="gap-2">
              {savingSenha ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} Alterar senha
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
