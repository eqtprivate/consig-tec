import React, { useState, useEffect } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { areasApi } from '@/lib/api/areas';
import { dashboardApi } from '@/lib/api/dashboard';
import { buildLabel, BUILD_TIME } from '@/lib/version';
import { LayoutDashboard, AlertCircle, Users, Link2, Settings, ScrollText, ChevronDown, Bell, TrendingUp, Plug, Building2, UserPlus, KeyRound, Palette, PanelLeft, LifeBuoy, ShieldCheck, Lock } from 'lucide-react';

// Modelo do menu (grupos/páginas) e aplicação da config por empresa.
import { AREA_SUBITEMS, buildCanonical, applyMenuConfig } from '@/lib/menuModel';

// Ícones (lucide) das páginas fixas, por nome referenciado no menuModel.
const FIXO_ICON = { LayoutDashboard, AlertCircle };

function Badge({ value, tone = 'default' }) {
  if (!value) return null;
  const cls = tone === 'danger' ? 'snav-badge-danger' : 'snav-badge';
  return <span className={`ml-auto shrink-0 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center ${cls}`}>{value > 99 ? '99+' : value}</span>;
}

// Ponto de notificação no ícone quando o menu está colapsado.
function Dot({ value, tone = 'default' }) {
  if (!value) return null;
  return (
    <span
      className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
      style={{ background: tone === 'danger' ? '#f4607f' : 'hsl(var(--sidebar-primary))', boxShadow: '0 0 0 2px hsl(var(--sidebar-background))' }}
    />
  );
}

function initials(nome) {
  if (!nome) return 'U';
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

export default function Sidebar({ collapsed = false }) {
  const { perfil, isAdmin, isSuperadmin, activeUnidade, vinculos, hasAreaAccess, brand, menuConfig } = useAuth();
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
      'formalizacao|ingestao': n('ingestoes_conferencia'),
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

  const itemClass = (active) => `snav-item ${active ? 'snav-item-active' : ''} ${collapsed ? 'justify-center !px-0' : ''}`;

  const navItem = (to, label, icon, badge = 0, tone = 'default') => {
    const active = location.pathname === to;
    const Icon = icon;
    return (
      <Link key={to} to={to} className={itemClass(active)} title={collapsed ? label : undefined}>
        <span className="snav-ico relative">
          <Icon className="w-4 h-4" />
          {collapsed && <Dot value={badge} tone={tone} />}
        </span>
        {!collapsed && <span className="flex-1 truncate">{label}</span>}
        {!collapsed && <Badge value={badge} tone={tone} />}
      </Link>
    );
  };

  // Menu montado a partir do modelo canônico + config da empresa (ordem/oculto).
  // Só entram grupos que o usuário pode acessar (áreas via hasAreaAccess).
  const gruposMenu = applyMenuConfig(buildCanonical(visibleAreas), menuConfig).filter((g) => !g.oculto);

  const renderGrupo = (g) => {
    if (g.tipo === 'fixo') {
      const Icon = FIXO_ICON[g.icon] || LayoutDashboard;
      const badge = g.key === 'pendencias' ? n('pendencias_abertas') : 0;
      const tone = g.key === 'pendencias' && n('pendencias_criticas') ? 'danger' : 'default';
      return navItem(g.to, g.nome, Icon, badge, tone);
    }
    // Área (com páginas configuráveis)
    const codigo = g.areaCodigo;
    const to = `/area/${codigo}`;
    const active = isOnArea(codigo);
    const emoji = g.emoji;
    const aBadge = areaBadge(codigo);
    const danger = codigo === 'cobranca';
    const subitens = (g.paginas || []).filter((p) => !p.oculto);
    const open = isOpen(codigo);
    const defaultTab = subitens[0]?.key;

    if (collapsed) {
      return (
        <Link key={g.key} to={to} className={itemClass(active)} title={g.nome}>
          <span className="snav-ico relative" aria-hidden>{emoji}<Dot value={aBadge} tone={danger ? 'danger' : 'default'} /></span>
        </Link>
      );
    }
    if (subitens.length === 0) {
      return (
        <Link key={g.key} to={to} className={itemClass(active)}>
          <span className="snav-ico" aria-hidden>{emoji}</span>
          <span className="flex-1 truncate">{g.nome}</span>
          <Badge value={aBadge} tone={danger ? 'danger' : 'default'} />
        </Link>
      );
    }
    return (
      <div key={g.key}>
        <div className={`${itemClass(active)} !pr-1`}>
          <Link to={to} className="flex items-center gap-2.5 flex-1 min-w-0" style={{ color: 'inherit' }}>
            <span className="snav-ico" aria-hidden>{emoji}</span>
            <span className="truncate flex-1">{g.nome}</span>
            {!open && <Badge value={aBadge} />}
          </Link>
          <button type="button" onClick={() => toggle(codigo)} aria-label={open ? 'Recolher' : 'Expandir'} className="p-1.5 shrink-0 rounded-md opacity-70 hover:opacity-100" style={{ color: 'inherit' }}>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
        {open && (
          <div className="ml-5 mt-0.5 mb-1 pl-3 space-y-0.5" style={{ borderLeft: '1px solid hsl(var(--sidebar-border))' }}>
            {subitens.map((s) => {
              const subActive = active && (currentTab || defaultTab) === s.key;
              const b = subBadge(codigo, s.key);
              return (
                <Link key={s.key} to={`${to}?tab=${s.key}`} className={`flex items-center px-3 py-1.5 rounded-lg text-xs ${subActive ? 'snav-sub-active' : 'snav-sub'}`}>
                  <span className="flex-1 truncate">{s.label}</span>
                  <Badge value={b} tone={s.key === 'carteira' ? 'danger' : 'default'} />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const papeisUnidade = activeUnidade
    ? vinculos.filter((v) => v.franquia_id === activeUnidade.id).map((v) => v.papel?.nome).filter(Boolean)
    : [];

  return (
    <aside className={`snav ${collapsed ? 'w-[76px]' : 'w-64'} flex flex-col h-full transition-[width] duration-200`}>
      {/* Header — logomarca da empresa (white-label). A sidebar é escura, então
          usa a versão p/ FUNDO ESCURO (fallback: logo clara → CONSIGTEC). */}
      <div className={`${collapsed ? 'px-0 justify-center' : 'px-5'} pt-6 pb-4 flex items-center`}>
        {(brand?.logo_url_dark || brand?.logo_url)
          ? <img src={brand.logo_url_dark || brand.logo_url} alt={brand.nome || 'Logo'} className={collapsed ? 'h-8 w-8 object-contain' : 'h-9 w-auto max-w-[170px] object-contain block'} />
          : (collapsed
            ? <img src="/brand/consigtec_logo_icon.png" alt="CONSIGTEC" className="h-8 w-8" />
            : <img src="/brand/consigtec_logo_dark.png" alt="CONSIGTEC" className="h-9 w-auto block" />)}
      </div>
      <div className={`snav-divider ${collapsed ? 'mx-3' : 'mx-4'}`} />

      {activeUnidade && !collapsed && (
        <div className="mx-3 mt-3 rounded-xl px-3 py-2.5" style={{ background: 'hsl(var(--sidebar-foreground) / 0.06)' }}>
          <p className="snav-label text-[10px] uppercase tracking-wider mb-1">Unidade ativa</p>
          <p className="text-xs font-medium truncate" style={{ color: 'hsl(var(--sidebar-foreground))' }}>{activeUnidade.nome}</p>
          {papeisUnidade.length > 0 && (
            <p className="snav-label text-[10px] mt-0.5 truncate">{papeisUnidade.join(', ')}</p>
          )}
        </div>
      )}

      <nav className={`flex-1 overflow-y-auto overflow-x-hidden ${collapsed ? 'px-2' : 'px-3'} py-4 space-y-6`}>
        <div className="space-y-1">
          {gruposMenu.map((g) => renderGrupo(g))}
        </div>

        {isSuperadmin && (
          <div className="space-y-1">
            {!collapsed && <p className="snav-label text-[10px] uppercase tracking-wider px-3 mb-2">Clientes (CONSIGTEC)</p>}
            {navItem('/admin/empresas', 'Empresas & Planos', Building2)}
            {navItem('/admin/onboarding', 'Novo cliente', UserPlus)}
            {navItem('/admin/pixconsig', 'Credenciais PixConsig', KeyRound)}
            {navItem('/admin/documentos', 'Documentos', Lock)}
          </div>
        )}

        {isAdmin && (
          <div className="space-y-1">
            {!collapsed && <p className="snav-label text-[10px] uppercase tracking-wider px-3 mb-2">Administração</p>}
            {navItem('/admin/usuarios', 'Usuários', Users)}
            {navItem('/admin/vinculos', 'Vínculos', Link2)}
            {navItem('/admin/areas', 'Áreas & Papéis', Settings)}
            {navItem('/admin/personalizacao', 'Personalização', Palette)}
            {navItem('/admin/menu', 'Menu lateral', PanelLeft)}
            {navItem('/admin/notificacoes', 'Notificações', Bell)}
            {navItem('/admin/expansao', 'Expansão', TrendingUp)}
            {navItem('/admin/integracoes', 'Integrações', Plug)}
            {navItem('/admin/auditoria', 'Auditoria', ScrollText)}
          </div>
        )}
      </nav>

      {/* Ajuda: Suporte + Segurança & Compliance */}
      <div className={`${collapsed ? 'px-2' : 'px-3'} pt-2 pb-1`}>
        <Link to="/suporte" title="Suporte" className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'} px-2 py-1.5 rounded-md text-xs opacity-80 hover:opacity-100 transition-opacity`} style={{ color: 'hsl(var(--sidebar-foreground))' }}>
          <LifeBuoy className="w-4 h-4 shrink-0" />{!collapsed && <span>Suporte</span>}
        </Link>
        <Link to="/seguranca" title="Segurança & Compliance" className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'} px-2 py-1.5 rounded-md text-xs opacity-80 hover:opacity-100 transition-opacity`} style={{ color: 'hsl(var(--sidebar-foreground))' }}>
          <ShieldCheck className="w-4 h-4 shrink-0" />{!collapsed && <span>Segurança</span>}
        </Link>
      </div>

      {/* Rodapé — usuário com avatar (só o avatar quando colapsado) + versão */}
      <div className={`${collapsed ? 'px-2' : 'px-3'} py-3`} style={{ borderTop: '1px solid hsl(var(--sidebar-border))' }}>
        {collapsed ? (
          <div className="flex justify-center py-1" title={perfil?.nome}>
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
              style={{ background: 'hsl(var(--sidebar-primary) / 0.2)', color: 'hsl(var(--sidebar-primary))' }}
            >
              {initials(perfil?.nome)}
            </span>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </aside>
  );
}
