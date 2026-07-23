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
  // Arquivar (soft delete, reversivel): marca ativo=false/true.
  async arquivar(id, ativo) {
    return this.update(id, { ativo });
  },
  // Excluir definitivamente (so empresas VAZIAS; a RPC bloqueia se houver dados). Superadmin.
  async remove(id) {
    const { data, error } = await supabase.rpc('excluir_empresa', { p_id: id });
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
  async salvar({ empresa_id, tema, cor_primaria, logo_url, logo_url_dark }) {
    const { data, error } = await supabase.rpc('atualizar_branding_empresa', {
      p_empresa: empresa_id ?? null,
      p_tema: tema ?? null,
      p_cor: cor_primaria ?? null,
      p_logo: logo_url ?? null,
      p_logo_dark: logo_url_dark ?? null,
    });
    if (error) throw error;
    return data; // linha da empresa atualizada
  },
  // Upload de logomarca p/ o Storage (bucket público 'branding'); devolve a URL.
  async uploadLogo(empresaId, file, variante = 'logo') {
    if (!empresaId) throw new Error('Empresa não definida.');
    if (!file) throw new Error('Arquivo não informado.');
    const okTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!okTypes.includes(file.type)) throw new Error('Formato inválido (use PNG, SVG, WEBP ou JPG).');
    if (file.size > 1024 * 1024) throw new Error('Arquivo muito grande (máx. 1 MB).');
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    const path = `${empresaId}/${variante}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('branding').upload(path, file, { upsert: true, cacheControl: '3600', contentType: file.type });
    if (error) throw error;
    const { data } = supabase.storage.from('branding').getPublicUrl(path);
    return data.publicUrl;
  },
};

// Menu lateral configurável por empresa (admin edita a própria; superadmin qualquer).
export const menuApi = {
  async salvar({ empresa_id, config }) {
    const { data, error } = await supabase.rpc('atualizar_menu_empresa', {
      p_empresa: empresa_id ?? null, p_config: config ?? null,
    });
    if (error) throw error;
    return data;
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
