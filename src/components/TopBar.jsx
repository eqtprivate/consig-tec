import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { Building, ChevronDown, Check, LogOut, Menu, Sun, Moon } from 'lucide-react';
import { getTheme, toggleTheme } from '@/lib/theme';
import NotificationBell from '@/components/NotificationBell';

export default function TopBar({ onToggleSidebar }) {
  const { perfil, uniqueUnidades, activeUnidade, switchUnidade, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [theme, setThemeState] = useState(getTheme());
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const onToggleTheme = () => setThemeState(toggleTheme());

  return (
    <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4 gap-4">
      <button
        onClick={onToggleSidebar}
        className="lg:hidden p-1.5 hover:bg-muted rounded-md"
      >
        <Menu className="w-5 h-5 text-muted-foreground" />
      </button>

      {uniqueUnidades.length > 1 ? (
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 px-3 py-1.5 bg-muted hover:bg-accent rounded-lg border border-border transition-colors"
          >
            <Building className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground max-w-[200px] truncate">
              {activeUnidade?.nome || 'Selecionar unidade'}
            </span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>

          {open && (
            <div className="absolute top-full mt-1 left-0 w-72 bg-popover rounded-lg shadow-lg border border-border py-1 z-50">
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
        <p className="text-sm font-medium text-foreground">{activeUnidade?.nome || ''}</p>
      )}

      <div className="flex items-center gap-2">
        <NotificationBell />
        <button
          onClick={onToggleTheme}
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md"
          title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <div className="text-right hidden sm:block">
          <p className="text-xs font-medium text-foreground">{perfil?.nome}</p>
        </div>
        <button
          onClick={logout}
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md"
          title="Sair"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
