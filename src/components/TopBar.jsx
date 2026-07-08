import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { Building, ChevronDown, Check, LogOut, Menu, X } from 'lucide-react';

export default function TopBar({ onToggleSidebar }) {
  const { perfil, uniqueUnidades, activeUnidade, switchUnidade, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 gap-4">
      <button
        onClick={onToggleSidebar}
        className="lg:hidden p-1.5 hover:bg-slate-100 rounded-md"
      >
        <Menu className="w-5 h-5 text-slate-600" />
      </button>

      {uniqueUnidades.length > 1 ? (
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
          >
            <Building className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700 max-w-[200px] truncate">
              {activeUnidade?.nome || 'Selecionar unidade'}
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          {open && (
            <div className="absolute top-full mt-1 left-0 w-72 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
              <p className="px-3 py-1.5 text-[10px] text-slate-500 uppercase tracking-wider">Trocar contexto</p>
              {uniqueUnidades.map((u) => (
                <button
                  key={u.id}
                  onClick={() => { switchUnidade(u); setOpen(false); }}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-700">{u.nome}</p>
                    <p className="text-xs text-slate-400">{[u.cidade, u.uf].filter(Boolean).join(' • ') || '—'}</p>
                  </div>
                  {activeUnidade?.id === u.id && <Check className="w-4 h-4 text-slate-700" />}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm font-medium text-slate-700">{activeUnidade?.nome || ''}</p>
      )}

      <div className="flex items-center gap-2">
        <div className="text-right hidden sm:block">
          <p className="text-xs font-medium text-slate-700">{perfil?.nome}</p>
        </div>
        <button
          onClick={logout}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md"
          title="Sair"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}