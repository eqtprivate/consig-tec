import { supabase } from '@/lib/supabaseClient';

export const pendenciasApi = {
  async list(filters = {}) {
    let query = supabase
      .from('pendencias')
      .select('*, area:areas(*), franquia:franquias(*), responsavel:usuarios(*)')
      .order('created_at', { ascending: false });

    if (filters.area_id) query = query.eq('area_id', filters.area_id);
    if (filters.franquia_id) query = query.eq('franquia_id', filters.franquia_id);
    if (filters.responsavel_id) query = query.eq('responsavel_id', filters.responsavel_id);
    if (filters.prioridade) query = query.eq('prioridade', filters.prioridade);
    if (filters.status) query = query.eq('status', filters.status);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  async create(pendencia) {
    const { data, error } = await supabase.from('pendencias').insert(pendencia).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('pendencias').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from('pendencias').delete().eq('id', id);
    if (error) throw error;
  },
};