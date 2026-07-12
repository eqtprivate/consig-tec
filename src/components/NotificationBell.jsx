import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { notificacoesApi } from '@/lib/api/notificacoes';
import { Bell } from 'lucide-react';

const SEEN_KEY = 'consigtec_notif_seen';
const STATUS = { pendente: 'text-amber-600', enviado: 'text-green-600', erro: 'text-red-600' };

function tempo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return d.toLocaleDateString('pt-BR');
}

export default function NotificationBell() {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [itens, setItens] = useState([]);
  const [seen, setSeen] = useState(() => Number(localStorage.getItem(SEEN_KEY) || 0));
  const ref = useRef(null);

  const load = useCallback(() => {
    if (!isAdmin) return;
    notificacoesApi.recentes(15).then(setItens).catch(() => {});
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!isAdmin) return undefined;
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [isAdmin, load]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!isAdmin) return null;

  const naoLidas = itens.filter((n) => new Date(n.created_at).getTime() > seen).length;

  const abrir = () => {
    const novo = !open;
    setOpen(novo);
    if (novo) {
      const now = Date.now();
      localStorage.setItem(SEEN_KEY, String(now));
      setSeen(now);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={abrir} className="relative p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md" title="Notificações">
        <Bell className="w-4 h-4" />
        {naoLidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-1 right-0 w-80 bg-popover rounded-lg shadow-lg border border-border py-1 z-50">
          <div className="flex items-center justify-between px-3 py-1.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Notificações</p>
            <Link to="/admin/notificacoes" onClick={() => setOpen(false)} className="text-[11px] text-primary hover:underline">Ver todas</Link>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {itens.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">Nenhuma notificação.</p>
            ) : (
              itens.map((n) => (
                <div key={n.id} className="px-3 py-2 hover:bg-muted border-t border-border/50 first:border-t-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground truncate">{n.assunto || n.evento || 'Notificação'}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">{tempo(n.created_at)}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {n.evento} · <span className={STATUS[n.status_envio] || ''}>{n.status_envio}</span>
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
