import { supabase } from '@/lib/supabaseClient';

export const unidadesApi = {
  async list() {
    const { data, error } = await supabase
      .from('unidades')
      .select('*, empresa:empresas(*)')
      .order('nome');
    if (error) throw error;
    return data;
  },
  async create(unidade) {
    const { data, error } = await supabase.from('unidades').insert(unidade).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('unidades').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from('unidades').delete().eq('id', id);
    if (error) throw error;
  },
};