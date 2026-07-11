import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, initSupabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await initSupabase();
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset`,
      });
    } catch {
      // Sempre mostra sucesso (evita enumeração de contas).
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: 'linear-gradient(150deg, #1a2733 0%, #2E4053 60%, #37506a 100%)' }}>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src="/brand/consigtec_logo_dark.png" alt="CONSIGTEC" className="h-14 w-auto mb-3" />
          <p className="text-sm text-slate-300">Recuperação de senha</p>
        </div>
        <div className="bg-white rounded-xl shadow-2xl p-8">
          {sent ? (
            <div className="text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                <Mail className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-sm text-slate-600">
                Se existir uma conta com esse e-mail, você receberá um link para redefinir a senha em instantes.
              </p>
              <Link to="/login" className="text-sm text-primary font-medium hover:underline inline-block mt-2">
                <ArrowLeft className="w-3 h-3 inline mr-1" />Voltar ao login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-slate-900 mb-1">Esqueci minha senha</h2>
              <p className="text-sm text-slate-500 mb-6">Enviaremos um link de redefinição para o seu e-mail.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input id="email" type="email" autoComplete="email" autoFocus placeholder="seu@email.com"
                           value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-11" required />
                  </div>
                </div>
                <Button type="submit" className="w-full h-11 font-medium" disabled={loading}>
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</> : 'Enviar link'}
                </Button>
              </form>
              <Link to="/login" className="block text-center text-xs text-slate-400 hover:text-slate-600 mt-4">
                <ArrowLeft className="w-3 h-3 inline mr-1" />Voltar ao login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
