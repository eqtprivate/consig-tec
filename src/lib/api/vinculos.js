import { supabase } from '@/lib/supabaseClient';

export const vinculosApi = {
  async list() {
    const { data, error } = await supabase
      .from('vinculos')
      .select('*, usuario:usuarios(*), empresa:empresas(*), franquia:franquias(*), area:areas(*), papel:papeis(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  async create(vinculo) {
    const { data, error } = await supabase.from('vinculos').insert(vinculo).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('vinculos').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from('vinculos').delete().eq('id', id);
    if (error) throw error;
  },
};