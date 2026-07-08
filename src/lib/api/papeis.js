import { supabase } from '@/lib/supabaseClient';

export const papeisApi = {
  async list() {
    const { data, error } = await supabase.from('papeis').select('*').order('nome');
    if (error) throw error;
    return data;
  },
};
