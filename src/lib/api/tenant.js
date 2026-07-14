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
