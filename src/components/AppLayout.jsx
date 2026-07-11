import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import TrocarSenha from '@/pages/TrocarSenha';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

function ContaInativa({ onLogout }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md text-center">
        <div className="w-14 h-14 rounded-xl bg-slate-800 flex items-center justify-center mb-4 ring-1 ring-slate-700 mx-auto">
          <ShieldAlert className="w-7 h-7 text-amber-400" />
        </div>
        <h1 className="text-xl font-bold text-white">Conta inativa</h1>
        <p className="text-sm text-slate-400 mt-2">Seu acesso foi desativado. Fale com um administrador do grupo.</p>
        <Button onClick={onLogout} variant="outline" className="mt-6">Sair</Button>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { perfil, logout } = useAuth();

  // Gates de acesso
  if (perfil && perfil.ativo === false) return <ContaInativa onLogout={logout} />;
  if (perfil?.must_change_password) return <TrocarSenha />;

  return (
    <div className="dark dark-app h-screen flex overflow-hidden">
      <div className="hidden lg:block shrink-0">
        <Sidebar />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0">
            <Sidebar />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
