import { supabase } from '@/lib/supabaseClient';

export const areasApi = {
  async list() {
    const { data, error } = await supabase.from('areas').select('*').order('nome');
    if (error) throw error;
    return data;
  },
  async create(area) {
    const { data, error } = await supabase.from('areas').insert(area).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('areas').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from('areas').delete().eq('id', id);
    if (error) throw error;
  },
};