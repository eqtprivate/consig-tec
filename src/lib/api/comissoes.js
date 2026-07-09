import { supabase } from '@/lib/supabaseClient';

export const comissoesApi = {
  async list(filters = {}) {
    let query = supabase
      .from('comissoes')
      .select('*, contrato:contratos(*), usuario:usuarios(nome), franquia:franquias(*)')
      .order('created_at', { ascending: false });
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.usuario_id) query = query.eq('usuario_id', filters.usuario_id);
    if (filters.franquia_id) query = query.eq('franquia_id', filters.franquia_id);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  async create(comissao) {
    const { data, error } = await supabase.from('comissoes').insert(comissao).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('comissoes').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
};
