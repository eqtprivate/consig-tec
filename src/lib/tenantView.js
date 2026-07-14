// "Ver como" empresa (superadmin). Guarda a empresa em foco para filtrar
// as listas no cliente. Só afeta superadmin — demais papéis já são isolados
// pela RLS. As APIs de lista leem getEmpresaView() e aplicam .eq('empresa_id').
const KEY = 'consigtec_empresa_view';

export const getEmpresaView = () => {
  try { return localStorage.getItem(KEY) || null; } catch { return null; }
};

export const setEmpresaViewStore = (id) => {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch { /* ignore */ }
};

// Franquias da empresa em foco — para filtrar as tabelas que só têm
// franquia_id (leads, cobrança, comissões, repasses…). null = sem filtro.
const FKEY = 'consigtec_franquias_view';

export const getFranquiasView = () => {
  try { const raw = localStorage.getItem(FKEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
};

export const setFranquiasViewStore = (ids) => {
  try {
    if (Array.isArray(ids)) localStorage.setItem(FKEY, JSON.stringify(ids));
    else localStorage.removeItem(FKEY);
  } catch { /* ignore */ }
};
