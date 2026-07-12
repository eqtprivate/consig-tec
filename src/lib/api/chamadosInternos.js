import { supabase } from '@/lib/supabaseClient';

const SELECT =
  '*, solicitante:usuarios!solicitante_id(id, nome), ' +
  'responsavel:usuarios!responsavel_id(id, nome), ' +
  'area:areas(id, nome)';

export const chamadosInternosApi = {
  async list(filters = {}) {
    let q = supabase.from('chamados_internos').select(SELECT).order('updated_at', { ascending: false });
    if (filters.status) q = q.eq('status', filters.status);
    if (filters.responsavel_id) q = q.eq('responsavel_id', filters.responsavel_id);
    if (filters.solicitante_id) q = q.eq('solicitante_id', filters.solicitante_id);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  },
  async create(item) {
    const { data, error } = await supabase.from('chamados_internos').insert(item).select(SELECT).single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('chamados_internos').update(updates).eq('id', id).select(SELECT).single();
    if (error) throw error;
    return data;
  },
  async mensagens(chamadoId) {
    const { data, error } = await supabase
      .from('chamados_internos_mensagens')
      .select('*, autor:usuarios(id, nome)')
      .eq('chamado_id', chamadoId)
      .order('created_at');
    if (error) throw error;
    return data;
  },
  async enviarMensagem(chamadoId, corpo) {
    const { data, error } = await supabase
      .from('chamados_internos_mensagens')
      .insert({ chamado_id: chamadoId, corpo })
      .select('*, autor:usuarios(id, nome)')
      .single();
    if (error) throw error;
    return data;
  },
};
