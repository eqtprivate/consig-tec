import React, { useState } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import TrocarSenha from '@/pages/TrocarSenha';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { Button } from '@/components/ui/button';
import { ShieldAlert, LifeBuoy, ShieldCheck } from 'lucide-react';

const DOC_COMPLIANCE = 'https://claude.ai/code/artifact/c8136f02-7fb1-4629-a40b-f550def0ceeb';

function ContaInativa({ onLogout }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center">
        <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center mb-4 ring-1 ring-border mx-auto">
          <ShieldAlert className="w-7 h-7 text-amber-500" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Conta inativa</h1>
        <p className="text-sm text-muted-foreground mt-2">Seu acesso foi desativado. Fale com um administrador do grupo.</p>
        <Button onClick={onLogout} variant="outline" className="mt-6">Sair</Button>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('consigtec_sidebar_collapsed') === '1'; } catch { return false; }
  });
  const { perfil, logout } = useAuth();
  const location = useLocation();

  const toggleCollapsed = () => setCollapsed((c) => {
    const next = !c;
    try { localStorage.setItem('consigtec_sidebar_collapsed', next ? '1' : '0'); } catch { /* ignore */ }
    return next;
  });

  // Gates de acesso
  if (perfil && perfil.ativo === false) return <ContaInativa onLogout={logout} />;
  if (perfil?.must_change_password) return <TrocarSenha />;

  return (
    <div className="bg-background text-foreground h-screen flex overflow-hidden">
      <div className="hidden lg:block shrink-0">
        <Sidebar collapsed={collapsed} />
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
        <TopBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} onToggleCollapse={toggleCollapsed} collapsed={collapsed} />
        <main className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
          <footer className="mt-8 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><img src="/brand/consigtec_logo_icon.png" alt="" className="w-4 h-4 rounded" /> CONSIGTEC</span>
            <div className="flex items-center gap-4">
              <Link to="/suporte" className="hover:text-foreground inline-flex items-center gap-1"><LifeBuoy className="w-3.5 h-3.5" /> Suporte</Link>
              <a href={DOC_COMPLIANCE} target="_blank" rel="noreferrer" className="hover:text-foreground inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Segurança &amp; Privacidade</a>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
