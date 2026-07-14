import { supabase } from '@/lib/supabaseClient';

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

// Empresa efetiva para GRAVAÇÃO (imports manuais etc.): empresa em foco do
// superadmin OU a empresa do próprio usuário. Cacheia a empresa do usuário para
// não consultar o perfil a cada linha. `explicit` (se dado) tem prioridade.
let _minhaEmpresa;
export const resolveEmpresaId = async (explicit) => {
  if (explicit) return explicit;
  const ev = getEmpresaView();
  if (ev) return ev;
  if (_minhaEmpresa !== undefined) return _minhaEmpresa;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return (_minhaEmpresa = null);
    const { data } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle();
    _minhaEmpresa = data?.empresa_id || null;
  } catch { _minhaEmpresa = null; }
  return _minhaEmpresa;
};
