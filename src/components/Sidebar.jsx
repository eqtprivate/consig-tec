import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { areasApi } from '@/lib/api/areas';
import { LayoutDashboard, AlertCircle, Users, Link2, Settings, ScrollText, ChevronRight } from 'lucide-react';

export default function Sidebar() {
  const { perfil, isAdmin, availableAreas, activeUnidade, vinculos } = useAuth();
  const location = useLocation();
  const [allAreas, setAllAreas] = useState([]);

  useEffect(() => {
    areasApi.list().then(setAllAreas).catch(() => {});
  }, []);

  const visibleAreas = allAreas.filter((a) =>
    isAdmin || availableAreas.some((va) => va.codigo === a.codigo)
  );

  const itemClass = (active) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      active
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
    }`;

  const navItem = (to, label, icon) => {
    const active = location.pathname === to;
    const Icon = icon;
    return (
      <Link key={to} to={to} className={itemClass(active)}>
        <Icon className="w-4 h-4 shrink-0" />
        {label}
      </Link>
    );
  };

  const papeisUnidade = activeUnidade
    ? vinculos.filter((v) => v.franquia_id === activeUnidade.id).map((v) => v.papel?.nome).filter(Boolean)
    : [];

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col h-full">
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-extrabold tracking-tight"
               style={{ background: 'linear-gradient(150deg, hsl(var(--primary)), #805dca)', boxShadow: '0 8px 20px -8px hsl(var(--primary))' }}>
            C
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground tracking-tight">CONSIGTEC</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Grupo Raman</p>
          </div>
        </div>
      </div>

      {activeUnidade && (
        <div className="px-4 py-3 border-b border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Unidade ativa</p>
          <p className="text-xs font-medium text-foreground truncate">{activeUnidade.nome}</p>
          {papeisUnidade.length > 0 && (
            <p className="text-[10px] text-muted-foreground mt-0.5">{papeisUnidade.join(', ')}</p>
          )}
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-3 mb-2">Principal</p>
          {navItem('/', 'Dashboard', LayoutDashboard)}
          {navItem('/pendencias', 'Central de Pendências', AlertCircle)}
        </div>

        {visibleAreas.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-3 mb-2">Áreas</p>
            {visibleAreas.map((area) => {
              const to = `/area/${area.codigo}`;
              const active = location.pathname === to;
              return (
                <Link key={area.id} to={to} className={itemClass(active)}>
                  <ChevronRight className="w-3 h-3 shrink-0" />
                  {area.nome}
                </Link>
              );
            })}
          </div>
        )}

        {isAdmin && (
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-3 mb-2">Administração</p>
            {navItem('/admin/usuarios', 'Usuários', Users)}
            {navItem('/admin/vinculos', 'Vínculos', Link2)}
            {navItem('/admin/areas', 'Áreas', Settings)}
            {navItem('/admin/auditoria', 'Auditoria', ScrollText)}
          </div>
        )}
      </nav>

      <div className="px-4 py-3 border-t border-border">
        <p className="text-xs text-foreground font-medium truncate">{perfil?.nome || 'Usuário'}</p>
        <p className="text-[10px] text-muted-foreground truncate">{perfil?.email}</p>
      </div>
    </aside>
  );
}
