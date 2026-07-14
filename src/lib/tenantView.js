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
