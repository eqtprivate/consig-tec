import { supabase } from '@/lib/supabaseClient';
import { getFranquiasView } from '@/lib/tenantView';

export const comissoesApi = {
  async list(filters = {}) {
    let query = supabase
      .from('comissoes')
      .select('*, contrato:contratos(*), usuario:usuarios(nome), franquia:franquias(*)')
      .order('created_at', { ascending: false });
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.usuario_id) query = query.eq('usuario_id', filters.usuario_id);
    if (filters.franquia_id) query = query.eq('franquia_id', filters.franquia_id);
    const __fv = getFranquiasView(); if (__fv) query = query.in('franquia_id', __fv);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  async create(comissao) {
    const { data, error } = await supabase.from('comissoes').insert(comissao).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('comissoes').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  // Estágio 7 — motor de rateio no banco
  async calcularContrato(contratoId) {
    const { data, error } = await supabase.rpc('calcular_comissoes_contrato', { p_contrato: contratoId });
    if (error) throw error;
    return data; // nº de comissões geradas (0 se já existiam)
  },
};

export const regrasComissaoApi = {
  async list() {
    const { data, error } = await supabase
      .from('regras_comissao')
      .select('*, convenio:convenios(id, nome)')
      .order('convenio_id', { nullsFirst: true });
    if (error) throw error;
    return data;
  },
  async create(item) {
    const { data, error } = await supabase.from('regras_comissao').insert(item).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('regras_comissao').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from('regras_comissao').delete().eq('id', id);
    if (error) throw error;
  },
};
