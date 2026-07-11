import { supabase } from '@/lib/supabaseClient';

const SELECT = '*, convenio:convenios(id, nome), franquia:franquias(id, nome)';

export const repassesApi = {
  async list(filters = {}) {
    let query = supabase.from('repasses_folha').select(SELECT).order('competencia', { ascending: false });
    if (filters.franquia_id) query = query.eq('franquia_id', filters.franquia_id);
    if (filters.status) query = query.eq('status', filters.status);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  async create(item) {
    const { data, error } = await supabase.from('repasses_folha').insert(item).select(SELECT).single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('repasses_folha').update(updates).eq('id', id).select(SELECT).single();
    if (error) throw error;
    return data;
  },
};
