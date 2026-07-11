import { supabase } from '@/lib/supabaseClient';

export const papeisApi = {
  async list() {
    const { data, error } = await supabase.from('papeis').select('*').order('nome');
    if (error) throw error;
    return data;
  },
  async create(item) {
    const { data, error } = await supabase.from('papeis').insert(item).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('papeis').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from('papeis').delete().eq('id', id);
    if (error) throw error;
  },
};
