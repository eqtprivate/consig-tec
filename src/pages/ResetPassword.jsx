import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase, initSupabase } from '@/lib/supabaseClient';
import { validarSenha } from '@/lib/validators';
import PasswordChecklist from '@/components/PasswordChecklist';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Loader2 } from 'lucide-react';

export default function ResetPassword() {
  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [temSessao, setTemSessao] = useState(null); // null=checando, true/false

  useEffect(() => {
    let sub;
    (async () => {
      await initSupabase();
      // O link de recuperação traz o token na URL; o cliente detecta a sessão.
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setTemSessao(true);
      const { data } = supabase.auth.onAuthStateChange((event, s) => {
        if (event === 'PASSWORD_RECOVERY' || s) setTemSessao(true);
      });
      sub = data.subscription;
      // fallback: se em 2.5s não houver sessão, considera link inválido
      setTimeout(() => setTemSessao((v) => (v === null ? false : v)), 2500);
    })();
    return () => sub?.unsubscribe();
  }, []);

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
      try { await supabase.rpc('marcar_senha_trocada'); } catch { /* best-effort: não bloqueia a troca de senha */ }
      window.location.href = '/';
    } catch (err) {
      setErro(err.message || 'Não foi possível redefinir a senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: 'linear-gradient(150deg, #1a2733 0%, #2E4053 60%, #37506a 100%)' }}>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src="/brand/consigtec_logo_dark.png" alt="CONSIGTEC" className="h-14 w-auto mb-3" />
          <p className="text-sm text-slate-300">Definir nova senha</p>
        </div>
        <div className="bg-white rounded-xl shadow-2xl p-8">
          {temSessao === false ? (
            <div className="text-center space-y-3">
              <p className="text-sm text-slate-600">O link de redefinição é inválido ou expirou.</p>
              <Link to="/forgot" className="text-sm text-primary font-medium hover:underline inline-block">Solicitar novo link</Link>
            </div>
          ) : temSessao === null ? (
            <div className="text-center py-6"><Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto" /></div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {erro && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{erro}</div>}
              <div className="space-y-2">
                <Label htmlFor="s1">Nova senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input id="s1" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} className="pl-10 h-11" required />
                </div>
                <p className="text-xs text-slate-400">Mínimo 8 caracteres, com letra e número.</p>
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
          )}
        </div>
      </div>
    </div>
  );
}
