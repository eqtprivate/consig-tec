import { supabase } from '@/lib/supabaseClient';

export const leadsApi = {
  async list(filters = {}) {
    let query = supabase.from('leads')
      .select('*, campanha:campanhas(id, nome), responsavel:usuarios(nome)')
      .order('created_at', { ascending: false });
    if (filters.franquia_id) query = query.eq('franquia_id', filters.franquia_id);
    if (filters.status) query = query.eq('status', filters.status);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  async create(item) {
    const { data, error } = await supabase.from('leads').insert(item).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('leads').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
};

export const campanhasApi = {
  async list(filters = {}) {
    let query = supabase.from('campanhas').select('*').order('created_at', { ascending: false });
    if (filters.franquia_id) query = query.eq('franquia_id', filters.franquia_id);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  async create(item) {
    const { data, error } = await supabase.from('campanhas').insert(item).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('campanhas').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
};
