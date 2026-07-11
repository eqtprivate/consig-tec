import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, initSupabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, Loader2, LogIn, Building2 } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await initSupabase();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      window.location.href = '/';
    } catch (err) {
      setError(err.message || 'Credenciais inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: 'linear-gradient(150deg, #0e1726 0%, hsl(230 60% 12%) 55%, hsl(230 50% 20%) 100%)' }}>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-extrabold text-xl mb-4"
               style={{ background: 'linear-gradient(150deg, hsl(var(--primary)), #805dca)', boxShadow: '0 10px 30px -8px hsl(var(--primary))' }}>
            C
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">CONSIGTEC</h1>
          <p className="text-sm text-slate-400 mt-1">Grupo Raman — Crédito Consignado</p>
        </div>

        <div className="bg-white rounded-xl shadow-2xl p-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Entrar</h2>
          <p className="text-sm text-slate-500 mb-6">Acesse sua conta para continuar</p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-11"
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-11 font-medium" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  Entrar
                </>
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          CONSIGTEC © {new Date().getFullYear()} Grupo Raman
        </p>
      </div>
    </div>
  );
}