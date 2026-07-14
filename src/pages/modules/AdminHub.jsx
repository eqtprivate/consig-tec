import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import PlanoUsoBanner from '@/components/PlanoUsoBanner';
import { Panel } from '@/components/kit';
import { Users, Link2, Settings, Bell, TrendingUp, Plug, ScrollText, ArrowRight, Building2, UserPlus, Palette, KeyRound, PanelLeft } from 'lucide-react';

const CARDS = [
  { to: '/admin/onboarding', icon: UserPlus, nome: 'Novo cliente (onboarding)', desc: 'Empresa + plano + unidade + admin em um passo', superadmin: true },
  { to: '/admin/empresas', icon: Building2, nome: 'Empresas & Planos', desc: 'Clientes (tenants) e planos de acesso', superadmin: true },
  { to: '/admin/pixconsig', icon: KeyRound, nome: 'Credenciais PixConsig', desc: 'Conta PixConsig (base URL + api key) por empresa', superadmin: true },
  { to: '/admin/personalizacao', icon: Palette, nome: 'Personalização', desc: 'Cores e logomarca da empresa (white-label)' },
  { to: '/admin/menu', icon: PanelLeft, nome: 'Menu lateral', desc: 'Reordenar grupos/páginas e ocultar itens' },
  { to: '/admin/usuarios', icon: Users, nome: 'Usuários', desc: 'Cadastro, papéis, senha temporária e ativação' },
  { to: '/admin/vinculos', icon: Link2, nome: 'Vínculos', desc: 'Usuário × unidade × papel (escopo de acesso)' },
  { to: '/admin/areas', icon: Settings, nome: 'Áreas & Papéis', desc: 'Áreas do processo e permissões por papel' },
  { to: '/admin/notificacoes', icon: Bell, nome: 'Notificações', desc: 'Fila de e-mails e eventos do sistema' },
  { to: '/admin/expansao', icon: TrendingUp, nome: 'Expansão', desc: 'Franquias, refinanciamento e portabilidade' },
  { to: '/admin/integracoes', icon: Plug, nome: 'Integrações', desc: 'PixConsig, UY3, Clicksign e webhooks' },
  { to: '/admin/auditoria', icon: ScrollText, nome: 'Auditoria', desc: 'Trilha de ações e alterações sensíveis' },
];

export default function AdminHub() {
  const { isAdmin, isSuperadmin } = useAuth();
  const cards = CARDS.filter((c) => !c.superadmin || isSuperadmin);

  if (!isAdmin) {
    return (
      <Panel className="text-center">
        <p className="text-sm text-muted-foreground">Acesso restrito a administradores.</p>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Central de administração — acessos, configuração e integrações do CONSIGTEC.</p>
      <PlanoUsoBanner />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map(({ to, icon: Icon, nome, desc }) => (
          <Link
            key={to}
            to={to}
            className="group bg-card rounded-xl border border-border shadow-sm p-4 hover:border-primary/40 hover-lift"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{nome}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-foreground transition-colors shrink-0" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
