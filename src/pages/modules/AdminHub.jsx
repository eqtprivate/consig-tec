import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { Users, Link2, Settings, Bell, TrendingUp, Plug, ScrollText, ArrowRight } from 'lucide-react';

const CARDS = [
  { to: '/admin/usuarios', icon: Users, nome: 'Usuários', desc: 'Cadastro, papéis, senha temporária e ativação' },
  { to: '/admin/vinculos', icon: Link2, nome: 'Vínculos', desc: 'Usuário × unidade × papel (escopo de acesso)' },
  { to: '/admin/areas', icon: Settings, nome: 'Áreas & Papéis', desc: 'Áreas do processo e permissões por papel' },
  { to: '/admin/notificacoes', icon: Bell, nome: 'Notificações', desc: 'Fila de e-mails e eventos do sistema' },
  { to: '/admin/expansao', icon: TrendingUp, nome: 'Expansão', desc: 'Franquias, refinanciamento e portabilidade' },
  { to: '/admin/integracoes', icon: Plug, nome: 'Integrações', desc: 'PixConsig, UY3, Clicksign e webhooks' },
  { to: '/admin/auditoria', icon: ScrollText, nome: 'Auditoria', desc: 'Trilha de ações e alterações sensíveis' },
];

export default function AdminHub() {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <p className="text-sm text-slate-500">Acesso restrito a administradores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Central de administração — acessos, configuração e integrações do CONSIGTEC.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {CARDS.map(({ to, icon: Icon, nome, desc }) => (
          <Link
            key={to}
            to={to}
            className="group bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{nome}</p>
                  <p className="text-xs text-slate-500">{desc}</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors shrink-0" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
