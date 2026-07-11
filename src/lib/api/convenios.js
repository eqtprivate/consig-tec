import { supabase } from '@/lib/supabaseClient';

export const conveniosApi = {
  async list() {
    const { data, error } = await supabase
      .from('convenios')
      .select('*, empresa:empresas(*), entidade:entidades_cadastro(*), overlay:overlay_comercial_convenio(*)')
      .order('nome');
    if (error) throw error;
    return data;
  },
  async create(convenio) {
    const { data, error } = await supabase.from('convenios').insert(convenio).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('convenios').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from('convenios').delete().eq('id', id);
    if (error) throw error;
  },
  // Upsert por chave externa da PixConsig — usado no import CSV/espelho.
  async upsertByPixconsig(convenio) {
    const { data, error } = await supabase
      .from('convenios')
      .upsert(convenio, { onConflict: 'pixconsig_convenio_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
