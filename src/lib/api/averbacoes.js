import { supabase } from '@/lib/supabaseClient';

export const averbacoesApi = {
  async list(filters = {}) {
    let query = supabase
      .from('averbacoes')
      .select('*, contrato:contratos(*, cliente:clientes(*)), convenio:convenios(*)')
      .order('created_at', { ascending: false });
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.contrato_id) query = query.eq('contrato_id', filters.contrato_id);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  async create(averbacao) {
    const { data, error } = await supabase.from('averbacoes').insert(averbacao).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('averbacoes').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
};
