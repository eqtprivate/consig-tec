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
  // Aplica um tipo (papel) numa franquia criando os vínculos das áreas padrão.
  async aplicarTipo(usuarioId, franquiaId, papelId) {
    const { data, error } = await supabase.rpc('aplicar_tipo_usuario', {
      p_usuario: usuarioId, p_franquia: franquiaId, p_papel: papelId,
    });
    if (error) throw error;
    return data; // nº de vínculos criados
  },
};