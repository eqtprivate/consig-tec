// Modelo canônico do menu lateral + aplicação da configuração por empresa.
// O Sidebar e o editor (/admin/menu) usam a MESMA fonte para montar os grupos.

// Subitens (páginas) por área — abrem via ?tab= no módulo.
export const AREA_SUBITEMS = {
  convenios: [
    { key: 'convenios', label: 'Convênios & Produtos' },
    { key: 'capacidade', label: 'Capacidade por Município' },
  ],
  crm: [
    { key: 'leads', label: 'Leads & Discagem' },
    { key: 'originacao', label: 'Originação de Leads' },
    { key: 'agenda', label: 'Agenda' },
    { key: 'oportunidades', label: 'Oportunidades' },
    { key: 'conversao', label: 'Conversão' },
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
    { key: 'ingestao', label: 'Ingestão de CCB' },
    { key: 'arquivo', label: 'Arquivo (CCBs)' },
    { key: 'ajustes', label: 'Ajustes da leitura' },
    { key: 'contratos', label: 'Contratos' },
  ],
  financeiro: [
    { key: 'receb', label: 'Recebíveis' },
    { key: 'carteira', label: 'Carteira' },
    { key: 'concil', label: 'Conciliação (repasse)' },
    { key: 'expectativa', label: 'Expectativa' },
    { key: 'previa', label: 'Prévia (cartão)' },
    { key: 'folha', label: 'Conciliação (folha)' },
    { key: 'monitor', label: 'Monitor' },
    { key: 'averbadoras', label: 'Averbadoras' },
    { key: 'historico', label: 'Carteira histórica' },
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
export const AREA_ICONS = {
  convenios: '🏛️', crm: '💬', averbacao: '📋', formalizacao: '📝',
  financeiro: '💰', comissoes: '💸', cobranca: '📞', cessao_fidc: '🔄',
  juridico: '⚖️', suporte: '🛟', admin: '⚙️',
};

// Páginas fixas (fora de áreas) que também entram no menu configurável.
export const GRUPOS_FIXOS = [
  { key: 'dashboard', nome: 'Dashboard', tipo: 'fixo', to: '/', icon: 'LayoutDashboard' },
  { key: 'pendencias', nome: 'Central de Pendências', tipo: 'fixo', to: '/pendencias', icon: 'AlertCircle', badgeKey: 'pendencias' },
];

// Monta a lista canônica de grupos a partir das áreas (DB). Cada grupo tem
// key estável ('dashboard' | 'pendencias' | 'area:<codigo>') e suas páginas.
export function buildCanonical(areas = []) {
  const areaGrupos = areas.map((a) => ({
    key: `area:${a.codigo}`,
    nome: a.nome,
    tipo: 'area',
    areaCodigo: a.codigo,
    emoji: AREA_ICONS[a.codigo] || '📁',
    paginas: (AREA_SUBITEMS[a.codigo] || []).map((s) => ({ key: s.key, label: s.label })),
  }));
  return [...GRUPOS_FIXOS.map((g) => ({ ...g, paginas: [] })), ...areaGrupos];
}

// Ordena a lista `paginas` conforme a config (ordem + oculto). Itens não
// citados na config ficam ao fim, visíveis por padrão.
function ordenarPorConfig(itens, cfgLista, chave = 'key') {
  if (!Array.isArray(cfgLista) || cfgLista.length === 0) return itens.map((i) => ({ ...i, oculto: false }));
  const ordem = new Map(cfgLista.map((c, i) => [c.key, i]));
  const ocultos = new Map(cfgLista.map((c) => [c.key, !!c.oculto]));
  const ordenados = [...itens].sort((a, b) => {
    const ia = ordem.has(a[chave]) ? ordem.get(a[chave]) : Number.MAX_SAFE_INTEGER;
    const ib = ordem.has(b[chave]) ? ordem.get(b[chave]) : Number.MAX_SAFE_INTEGER;
    return ia - ib;
  });
  return ordenados.map((i) => ({ ...i, oculto: ocultos.get(i[chave]) || false }));
}

// Aplica a config da empresa sobre a lista canônica → grupos ordenados, cada um
// com suas páginas ordenadas e a flag `oculto`. Sem config, devolve o padrão.
export function applyMenuConfig(canonical, config) {
  const cfg = config || {};
  const grupos = ordenarPorConfig(canonical, cfg.grupos);
  return grupos.map((g) => ({
    ...g,
    paginas: ordenarPorConfig(g.paginas || [], cfg.paginas?.[g.key]),
  }));
}
