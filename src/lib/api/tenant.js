import { supabase } from '@/lib/supabaseClient';

// Empresas (tenants / clientes da CONSIGTEC) e planos de acesso.
export const empresasApi = {
  async list() {
    const { data, error } = await supabase
      .from('empresas')
      .select('*, plano:planos(*)')
      .order('nome');
    if (error) throw error;
    return data;
  },
  async create(e) {
    const { data, error } = await supabase.from('empresas').insert(e).select('*, plano:planos(*)').single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('empresas').update(updates).eq('id', id).select('*, plano:planos(*)').single();
    if (error) throw error;
    return data;
  },
};

export const planosApi = {
  async list() {
    const { data, error } = await supabase.from('planos').select('*').order('ordem');
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('planos').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  // Uso × limites da empresa do usuário logado (para avisos).
  async uso() {
    const { data, error } = await supabase.rpc('plano_uso_empresa');
    if (error) throw error;
    return data; // { plano, uso } | null
  },
};

// Personalização (white-label) por empresa: cor primária + logomarca.
// Admin edita a própria empresa; superadmin edita a empresa em foco.
export const brandingApi = {
  async salvar({ empresa_id, cor_primaria, logo_url }) {
    const { data, error } = await supabase.rpc('atualizar_branding_empresa', {
      p_empresa: empresa_id ?? null, p_cor: cor_primaria ?? null, p_logo: logo_url ?? null,
    });
    if (error) throw error;
    return data; // linha da empresa atualizada
  },
};

// Credenciais PixConsig por empresa (superadmin). A api_key é sensível —
// gravamos, mas a listagem usa a RPC de status (não devolve a key).
export const pixCredApi = {
  async status() {
    const { data, error } = await supabase.rpc('pixconsig_credenciais_status');
    if (error) throw error;
    return data; // [{ empresa_id, empresa, base_url, tem_key, ativo, ultima_sincronizacao }]
  },
  async get(empresaId) {
    const { data, error } = await supabase.from('pixconsig_credenciais').select('*').eq('empresa_id', empresaId).maybeSingle();
    if (error) throw error;
    return data;
  },
  async save(empresaId, cred) {
    // não sobrescreve api_key/sync_token com vazio (deixa manter o valor atual)
    const patch = { empresa_id: empresaId, ...cred };
    if (patch.api_key === '' || patch.api_key == null) delete patch.api_key;
    if (patch.sync_token === '' || patch.sync_token == null) delete patch.sync_token;
    const { data, error } = await supabase.from('pixconsig_credenciais').upsert(patch, { onConflict: 'empresa_id' }).select().single();
    if (error) throw error;
    return data;
  },
};
