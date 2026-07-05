import { supabase } from '@/lib/supabaseClient';

export const empresasApi = {
  async list() {
    const { data, error } = await supabase.from('empresas').select('*').order('nome');
    if (error) throw error;
    return data;
  },
  async create(empresa) {
    const { data, error } = await supabase.from('empresas').insert(empresa).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('empresas').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from('empresas').delete().eq('id', id);
    if (error) throw error;
  },
};