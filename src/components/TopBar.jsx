import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { useLocation, Link } from 'react-router-dom';
import { Building, ChevronDown, Check, LogOut, Menu, Sun, Moon, Home, ChevronRight, PanelLeft } from 'lucide-react';
import { getTheme, toggleTheme } from '@/lib/theme';
import NotificationBell from '@/components/NotificationBell';

// Rótulos para o breadcrumb (inspirado no navbar do Material Dashboard).
const AREA_NOMES = {
  convenios: 'Convênios', crm: 'CRM / Vendas', averbacao: 'Averbação',
  formalizacao: 'Formalização', financeiro: 'Financeiro', comissoes: 'Comissões',
  cobranca: 'Cobrança', cessao_fidc: 'Cessão / FIDC', juridico: 'Jurídico', suporte: 'Suporte',
  admin: 'Administração',
};
const ADMIN_NOMES = {
  usuarios: 'Usuários', vinculos: 'Vínculos', areas: 'Áreas & Papéis',
  notificacoes: 'Notificações', expansao: 'Expansão', integracoes: 'Integrações', auditoria: 'Auditoria',
};

function useBreadcrumb() {
  const { pathname } = useLocation();
  const seg = pathname.split('/').filter(Boolean);
  if (seg.length === 0) return { section: null, title: 'Dashboard' };
  if (seg[0] === 'pendencias') return { section: null, title: 'Central de Pendências' };
  if (seg[0] === 'area') return { section: 'Áreas', title: AREA_NOMES[seg[1]] || seg[1] };
  if (seg[0] === 'admin') return { section: 'Administração', title: ADMIN_NOMES[seg[1]] || seg[1] };
  return { section: null, title: seg[seg.length - 1] };
}

function initials(nome) {
  if (!nome) return 'U';
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

const iconBtn = 'w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors';

export default function TopBar({ onToggleSidebar, onToggleCollapse, collapsed }) {
  const { perfil, uniqueUnidades, activeUnidade, switchUnidade, logout,
          isSuperadmin, empresasSuperadmin, empresaView, setEmpresaView } = useAuth();
  const [open, setOpen] = useState(false);
  const [theme, setThemeState] = useState(getTheme());
  const ref = useRef(null);
  const { section, title } = useBreadcrumb();
  const empresaViewNome = empresaView ? (empresasSuperadmin.find((e) => e.id === empresaView)?.nome || 'empresa') : null;

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const onToggleTheme = () => setThemeState(toggleTheme());

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-3 sm:px-6 gap-3">
      {/* Esquerda — menu (mobile) / recolher (desktop) + breadcrumb inline */}
      <div className="flex items-center gap-1.5 min-w-0">
        <button onClick={onToggleSidebar} className={`lg:hidden ${iconBtn}`} aria-label="Abrir menu">
          <Menu className="w-5 h-5" />
        </button>
        <button
          onClick={onToggleCollapse}
          className={`hidden lg:flex ${iconBtn}`}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          <PanelLeft className="w-5 h-5" />
        </button>
        <nav className="flex items-center gap-1.5 min-w-0 text-sm">
          <Link to="/" className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">Início</span>
          </Link>
          {section && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
              <span className="text-muted-foreground hidden md:inline shrink-0">{section}</span>
            </>
          )}
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
          <span className="font-semibold text-foreground truncate">{title}</span>
        </nav>
      </div>

      {/* Direita — contexto (unidade/empresa) + ações + conta */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {uniqueUnidades.length > 1 ? (
          <div className="relative" ref={ref}>
            <button
              onClick={() => setOpen(!open)}
              className="flex items-center gap-2 px-3 h-9 bg-muted hover:bg-accent rounded-lg border border-border transition-colors"
            >
              <Building className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium text-foreground max-w-[120px] sm:max-w-[180px] truncate">
                {activeUnidade?.nome || 'Selecionar unidade'}
              </span>
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
            {open && (
              <div className="absolute top-full mt-1.5 right-0 w-72 bg-popover rounded-xl shadow-lg border border-border py-1 z-50">
                <p className="px-3 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">Trocar contexto</p>
                {uniqueUnidades.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => { switchUnidade(u); setOpen(false); }}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{u.nome}</p>
                      <p className="text-xs text-muted-foreground">{[u.cidade, u.uf].filter(Boolean).join(' • ') || '—'}</p>
                    </div>
                    {activeUnidade?.id === u.id && <Check className="w-4 h-4 text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          activeUnidade?.nome && (
            <span className="hidden md:flex items-center gap-1.5 px-3 h-9 rounded-lg bg-muted text-sm font-medium text-foreground max-w-[200px] truncate">
              <Building className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="truncate">{activeUnidade.nome}</span>
            </span>
          )
        )}

        {isSuperadmin && empresasSuperadmin.length > 0 && (
          <select
            value={empresaView || ''}
            onChange={(e) => setEmpresaView(e.target.value || null)}
            title="Ver como empresa (superadmin)"
            className={`hidden sm:block text-xs rounded-lg border px-2 h-9 bg-muted text-foreground max-w-[160px] ${empresaView ? 'border-primary' : 'border-border'}`}
          >
            <option value="">Todas as empresas</option>
            {empresasSuperadmin.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        )}
        {empresaViewNome && (
          <span className="hidden lg:inline text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary">vendo: {empresaViewNome}</span>
        )}

        <NotificationBell />
        <button
          onClick={onToggleTheme}
          className={iconBtn}
          title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="w-px h-6 bg-border mx-0.5 hidden sm:block" />

        <Link
          to="/perfil"
          className="flex items-center gap-2 pl-0.5 pr-1 py-1 rounded-lg hover:bg-muted transition-colors"
          title="Meu perfil"
        >
          <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 bg-primary/10 text-primary">
            {initials(perfil?.nome)}
          </span>
          <div className="text-left hidden md:block min-w-0">
            <p className="text-xs font-medium text-foreground truncate max-w-[140px] leading-tight">{perfil?.nome}</p>
            <p className="text-[10px] text-muted-foreground truncate max-w-[140px] leading-tight">{perfil?.email}</p>
          </div>
        </Link>
        <button onClick={logout} className={iconBtn} title="Sair">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
