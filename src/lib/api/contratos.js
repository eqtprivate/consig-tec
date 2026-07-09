import { supabase } from '@/lib/supabaseClient';

export const contratosApi = {
  async list(filters = {}) {
    let query = supabase
      .from('contratos')
      .select('*, cliente:clientes(*), convenio:convenios(*)')
      .order('created_at', { ascending: false });
    if (filters.franquia_id) query = query.eq('franquia_id', filters.franquia_id);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.cliente_id) query = query.eq('cliente_id', filters.cliente_id);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  async create(contrato) {
    const { data, error } = await supabase.from('contratos').insert(contrato).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('contratos').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from('contratos').delete().eq('id', id);
    if (error) throw error;
  },
};
