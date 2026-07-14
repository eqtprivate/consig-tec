import React, { useState, useEffect } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { areasApi } from '@/lib/api/areas';
import { dashboardApi } from '@/lib/api/dashboard';
import { buildLabel, BUILD_TIME } from '@/lib/version';
import { LayoutDashboard, AlertCircle, Users, Link2, Settings, ScrollText, ChevronDown, Bell, TrendingUp, Plug } from 'lucide-react';

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
  suporte: [
    { key: 'internos', label: 'Chamados Internos' },
    { key: 'suporte', label: 'Chamados (suporte)' },
  ],
};

// Símbolo por área (mesma linguagem visual do Dashboard).
const AREA_ICONS = {
  convenios: '🏛️', crm: '💬', averbacao: '📋', formalizacao: '📝',
  financeiro: '💰', comissoes: '💸', cobranca: '📞', cessao_fidc: '🔄',
  juridico: '⚖️', suporte: '🛟', admin: '⚙️',
};

function Badge({ value, tone = 'default' }) {
  if (!value) return null;
  const cls = tone === 'danger' ? 'snav-badge-danger' : 'snav-badge';
  return <span className={`ml-auto shrink-0 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center ${cls}`}>{value > 99 ? '99+' : value}</span>;
}

function initials(nome) {
  if (!nome) return 'U';
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

export default function Sidebar() {
  const { perfil, isAdmin, activeUnidade, vinculos, hasAreaAccess } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [allAreas, setAllAreas] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [cont, setCont] = useState(null);

  useEffect(() => {
    areasApi.list().then(setAllAreas).catch(() => {});
  }, []);
  useEffect(() => {
    dashboardApi.contadores().then(setCont).catch(() => setCont(null));
  }, [location.pathname]);

  // Badge por subitem (chave da aba) e total por área.
  const n = (k) => Number(cont?.[k] || 0);
  const subBadge = (codigo, key) => {
    if (!cont) return 0;
    const map = {
      'crm|propostas': n('propostas_analise'),
      'averbacao|averbacoes': n('averbacoes_pendentes'),
      'formalizacao|form': n('formalizacoes_pendentes'),
      'financeiro|carteira': n('contratos_inadimplentes'),
      'juridico|chamados': n('chamados_abertos'),
      'juridico|lgpd': n('lgpd_pendentes'),
    };
    return map[`${codigo}|${key}`] || 0;
  };
  const areaBadge = (codigo) => {
    const subs = AREA_SUBITEMS[codigo] || [];
    let total = subs.reduce((s, it) => s + subBadge(codigo, it.key), 0);
    if (codigo === 'cobranca') total += n('cobrancas_abertas');
    return total;
  };

  const toggle = (codigo) => setExpanded((e) => ({ ...e, [codigo]: !isOpen(codigo) }));
  const isOnArea = (codigo) => location.pathname === `/area/${codigo}`;
  // Aberto se o usuário abriu manualmente, ou (por padrão) se está na área.
  const isOpen = (codigo) => expanded[codigo] ?? isOnArea(codigo);
  const currentTab = searchParams.get('tab');

  // Visibilidade = acesso por área (vínculo/admin) E módulo liberado pelo plano.
  const visibleAreas = allAreas.filter((a) => hasAreaAccess(a.codigo));

  const itemClass = (active) => `snav-item ${active ? 'snav-item-active' : ''}`;

  const navItem = (to, label, icon, badge = 0, tone = 'default') => {
    const active = location.pathname === to;
    const Icon = icon;
    return (
      <Link key={to} to={to} className={itemClass(active)}>
        <span className="snav-ico"><Icon className="w-4 h-4" /></span>
        <span className="flex-1 truncate">{label}</span>
        <Badge value={badge} tone={tone} />
      </Link>
    );
  };

  const papeisUnidade = activeUnidade
    ? vinculos.filter((v) => v.franquia_id === activeUnidade.id).map((v) => v.papel?.nome).filter(Boolean)
    : [];

  return (
    <aside className="snav w-64 flex flex-col h-full">
      {/* Header — logomarca sobre glow de marca + divisor em fade */}
      <div className="px-5 pt-6 pb-4">
        <img src="/brand/consigtec_logo_dark.png" alt="CONSIGTEC" className="h-9 w-auto block" />
      </div>
      <div className="snav-divider mx-4" />

      {activeUnidade && (
        <div className="mx-3 mt-3 rounded-xl px-3 py-2.5" style={{ background: 'hsl(var(--sidebar-foreground) / 0.06)' }}>
          <p className="snav-label text-[10px] uppercase tracking-wider mb-1">Unidade ativa</p>
          <p className="text-xs font-medium truncate" style={{ color: 'hsl(var(--sidebar-foreground))' }}>{activeUnidade.nome}</p>
          {papeisUnidade.length > 0 && (
            <p className="snav-label text-[10px] mt-0.5 truncate">{papeisUnidade.join(', ')}</p>
          )}
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div className="space-y-1">
          <p className="snav-label text-[10px] uppercase tracking-wider px-3 mb-2">Principal</p>
          {navItem('/', 'Dashboard', LayoutDashboard)}
          {navItem('/pendencias', 'Central de Pendências', AlertCircle, n('pendencias_abertas'), n('pendencias_criticas') ? 'danger' : 'default')}
        </div>

        {visibleAreas.length > 0 && (
          <div className="space-y-1">
            <p className="snav-label text-[10px] uppercase tracking-wider px-3 mb-2">Áreas</p>
            {visibleAreas.map((area) => {
              const to = `/area/${area.codigo}`;
              const active = isOnArea(area.codigo);
              const subitens = AREA_SUBITEMS[area.codigo];
              const open = isOpen(area.codigo);
              const defaultTab = subitens?.[0]?.key;
              const emoji = AREA_ICONS[area.codigo] || '📁';

              if (!subitens) {
                return (
                  <Link key={area.id} to={to} className={itemClass(active)}>
                    <span className="snav-ico" aria-hidden>{emoji}</span>
                    <span className="flex-1 truncate">{area.nome}</span>
                    <Badge value={areaBadge(area.codigo)} tone={area.codigo === 'cobranca' ? 'danger' : 'default'} />
                  </Link>
                );
              }
              const aBadge = areaBadge(area.codigo);
              return (
                <div key={area.id}>
                  <div className={`${itemClass(active)} !pr-1`}>
                    <Link to={to} className="flex items-center gap-2.5 flex-1 min-w-0" style={{ color: 'inherit' }}>
                      <span className="snav-ico" aria-hidden>{emoji}</span>
                      <span className="truncate flex-1">{area.nome}</span>
                      {!open && <Badge value={aBadge} />}
                    </Link>
                    <button
                      type="button"
                      onClick={() => toggle(area.codigo)}
                      aria-label={open ? 'Recolher' : 'Expandir'}
                      className="p-1.5 shrink-0 rounded-md opacity-70 hover:opacity-100"
                      style={{ color: 'inherit' }}
                    >
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  {open && (
                    <div className="ml-5 mt-0.5 mb-1 pl-3 space-y-0.5" style={{ borderLeft: '1px solid hsl(var(--sidebar-border))' }}>
                      {subitens.map((s) => {
                        const subActive = active && (currentTab || defaultTab) === s.key;
                        const b = subBadge(area.codigo, s.key);
                        return (
                          <Link
                            key={s.key}
                            to={`${to}?tab=${s.key}`}
                            className={`flex items-center px-3 py-1.5 rounded-lg text-xs ${subActive ? 'snav-sub-active' : 'snav-sub'}`}
                          >
                            <span className="flex-1 truncate">{s.label}</span>
                            <Badge value={b} tone={s.key === 'carteira' ? 'danger' : 'default'} />
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
            <p className="snav-label text-[10px] uppercase tracking-wider px-3 mb-2">Administração</p>
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

      {/* Rodapé — usuário com avatar + versão de build */}
      <div className="px-3 py-3" style={{ borderTop: '1px solid hsl(var(--sidebar-border))' }}>
        <div className="flex items-center gap-2.5 px-2 py-1">
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
            style={{ background: 'hsl(var(--sidebar-primary) / 0.2)', color: 'hsl(var(--sidebar-primary))' }}
          >
            {initials(perfil?.nome)}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: 'hsl(var(--sidebar-foreground))' }}>{perfil?.nome || 'Usuário'}</p>
            <p className="snav-label text-[10px] truncate">{perfil?.email}</p>
          </div>
        </div>
        <p className="snav-label text-[10px] mt-2 px-2 opacity-70" title={`Build ${BUILD_TIME}`}>CONSIGTEC {buildLabel()}</p>
      </div>
    </aside>
  );
}
