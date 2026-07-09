import { supabase } from '@/lib/supabaseClient';

export const clientesApi = {
  async list(filters = {}) {
    let query = supabase
      .from('clientes')
      .select('*, convenio:convenios(*)')
      .order('nome');
    if (filters.franquia_id) query = query.eq('franquia_id', filters.franquia_id);
    if (filters.convenio_id) query = query.eq('convenio_id', filters.convenio_id);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  async create(cliente) {
    const { data, error } = await supabase.from('clientes').insert(cliente).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('clientes').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from('clientes').delete().eq('id', id);
    if (error) throw error;
  },
};
