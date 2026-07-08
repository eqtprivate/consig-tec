import { supabase } from '@/lib/supabaseClient';

export const franquiasApi = {
  async list() {
    const { data, error } = await supabase
      .from('franquias')
      .select('*, empresa:empresas(*)')
      .order('nome');
    if (error) throw error;
    return data;
  },
  async create(franquia) {
    const { data, error } = await supabase.from('franquias').insert(franquia).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('franquias').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from('franquias').delete().eq('id', id);
    if (error) throw error;
  },
};
