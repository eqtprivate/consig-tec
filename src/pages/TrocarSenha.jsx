import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { validarSenha } from '@/lib/validators';
import PasswordChecklist from '@/components/PasswordChecklist';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Loader2, ShieldCheck } from 'lucide-react';

export default function TrocarSenha() {
  const { reloadUserData, logout } = useAuth();
  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    const problema = validarSenha(senha);
    if (problema) return setErro(problema);
    if (senha !== confirma) return setErro('As senhas não coincidem.');

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      await supabase.rpc('marcar_senha_trocada');
      await reloadUserData();
    } catch (err) {
      setErro(err.message || 'Não foi possível alterar a senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: 'linear-gradient(150deg, #1a2733 0%, #2E4053 60%, #37506a 100%)' }}>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center mb-4 ring-1 ring-white/15">
            <ShieldCheck className="w-7 h-7 text-slate-200" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Defina uma nova senha</h1>
          <p className="text-sm text-slate-400 mt-1 text-center">Você está usando uma senha temporária. Crie uma senha pessoal para continuar.</p>
        </div>

        <div className="bg-white rounded-xl shadow-2xl p-8">
          {erro && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{erro}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="s1">Nova senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input id="s1" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} className="pl-10 h-11" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="s2">Confirmar senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input id="s2" type="password" autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} className="pl-10 h-11" required />
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <PasswordChecklist senha={senha} confirma={confirma} />
            </div>
            <Button type="submit" className="w-full h-11 font-medium" disabled={loading || !!validarSenha(senha) || senha !== confirma}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : 'Salvar nova senha'}
            </Button>
          </form>
          <button onClick={logout} className="w-full mt-4 text-center text-xs text-slate-400 hover:text-slate-600">Sair</button>
        </div>
      </div>
    </div>
  );
}
