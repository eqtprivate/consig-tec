import React, { useState, useEffect } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { areasApi } from '@/lib/api/areas';
import { LayoutDashboard, AlertCircle, Users, Link2, Settings, ScrollText, ChevronRight, ChevronDown, Bell, TrendingUp, Plug } from 'lucide-react';

// Subitens (abas) por área — abrem via ?tab= no módulo.
const AREA_SUBITEMS = {
  convenios: [
    { key: 'convenios', label: 'Convênios & Produtos' },
    { key: 'capacidade', label: 'Capacidade por Município' },
  ],
  crm: [
    { key: 'leads', label: 'Leads & Discagem' },
    { key: 'agenda', label: 'Agenda' },
    { key: 'oportunidades', label: 'Oportunidades' },
    { key: 'clientes', label: 'Tomadores' },
    { key: 'propostas', label: 'Propostas' },
    { key: 'campanhas', label: 'Campanhas' },
    { key: 'comercial', label: 'Comercial' },
    { key: 'painel', label: 'Painel' },
    { key: 'config', label: 'Config' },
  ],
  averbacao: [
    { key: 'consulta', label: 'Consulta de Margem' },
    { key: 'averbacoes', label: 'Averbações' },
    { key: 'reconciliacao', label: 'Reconciliação' },
  ],
  formalizacao: [
    { key: 'form', label: 'Formalização & Antifraude' },
    { key: 'ccb', label: 'CCB' },
    { key: 'contratos', label: 'Contratos' },
  ],
  financeiro: [
    { key: 'receb', label: 'Recebíveis' },
    { key: 'carteira', label: 'Carteira' },
    { key: 'concil', label: 'Conciliação (repasse)' },
  ],
  comissoes: [
    { key: 'comissoes', label: 'Comissões' },
    { key: 'regras', label: 'Regras de rateio' },
  ],
  cessao_fidc: [
    { key: 'termos', label: 'Termos de cessão' },
    { key: 'fundos', label: 'Fundos & Partes' },
    { key: 'pdd', label: 'PDD' },
  ],
  juridico: [
    { key: 'lgpd', label: 'LGPD — Titular' },
    { key: 'chamados', label: 'Chamados jurídicos' },
  ],
};

export default function Sidebar() {
  const { perfil, isAdmin, availableAreas, activeUnidade, vinculos } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [allAreas, setAllAreas] = useState([]);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    areasApi.list().then(setAllAreas).catch(() => {});
  }, []);

  const toggle = (codigo) => setExpanded((e) => ({ ...e, [codigo]: !isOpen(codigo) }));
  const isOnArea = (codigo) => location.pathname === `/area/${codigo}`;
  // Aberto se o usuário abriu manualmente, ou (por padrão) se está na área.
  const isOpen = (codigo) => expanded[codigo] ?? isOnArea(codigo);
  const currentTab = searchParams.get('tab');

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
        <img src="/brand/consigtec_logo_white.png" alt="CONSIGTEC" className="h-10 w-auto block dark:hidden" />
        <img src="/brand/consigtec_logo_dark.png" alt="CONSIGTEC" className="h-10 w-auto hidden dark:block" />
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-2">Grupo Raman</p>
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
              const active = isOnArea(area.codigo);
              const subitens = AREA_SUBITEMS[area.codigo];
              const open = isOpen(area.codigo);
              const defaultTab = subitens?.[0]?.key;

              if (!subitens) {
                return (
                  <Link key={area.id} to={to} className={itemClass(active)}>
                    <ChevronRight className="w-3 h-3 shrink-0" />
                    {area.nome}
                  </Link>
                );
              }
              return (
                <div key={area.id}>
                  <div className={`flex items-center rounded-lg ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                    <Link to={to} className="flex items-center gap-3 px-3 py-2 text-sm font-medium flex-1 min-w-0">
                      <ChevronRight className="w-3 h-3 shrink-0" />
                      <span className="truncate">{area.nome}</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => toggle(area.codigo)}
                      aria-label={open ? 'Recolher' : 'Expandir'}
                      className="px-2 py-2 shrink-0 text-current/70 hover:text-current"
                    >
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  {open && (
                    <div className="ml-4 mt-0.5 mb-1 pl-2 border-l border-border space-y-0.5">
                      {subitens.map((s) => {
                        const subActive = active && (currentTab || defaultTab) === s.key;
                        return (
                          <Link
                            key={s.key}
                            to={`${to}?tab=${s.key}`}
                            className={`block px-3 py-1.5 rounded-md text-xs transition-colors ${
                              subActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                            }`}
                          >
                            {s.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {isAdmin && (
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-3 mb-2">Administração</p>
            {navItem('/admin/usuarios', 'Usuários', Users)}
            {navItem('/admin/vinculos', 'Vínculos', Link2)}
            {navItem('/admin/areas', 'Áreas & Papéis', Settings)}
            {navItem('/admin/notificacoes', 'Notificações', Bell)}
            {navItem('/admin/expansao', 'Expansão', TrendingUp)}
            {navItem('/admin/integracoes', 'Integrações', Plug)}
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
