import { supabase } from '@/lib/supabaseClient';

export const propostasApi = {
  async list(filters = {}) {
    let query = supabase
      .from('propostas')
      .select('*, cliente:clientes(*), convenio:convenios(*), matricula:matriculas(id, matricula, orgao, situacao, margem_disponivel)')
      .order('created_at', { ascending: false });
    if (filters.franquia_id) query = query.eq('franquia_id', filters.franquia_id);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.cliente_id) query = query.eq('cliente_id', filters.cliente_id);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  // Estágio 4 — reserva/liberação de margem apartada (funções no banco)
  async reservarMargem(propostaId) {
    const { data, error } = await supabase.rpc('reservar_margem_proposta', { p_proposta: propostaId });
    if (error) throw error;
    return data;
  },
  async liberarMargem(propostaId) {
    const { error } = await supabase.rpc('liberar_margem_proposta', { p_proposta: propostaId });
    if (error) throw error;
  },
  // Prontidão da esteira (formalização + antifraude + averbação) — Estágio 5.
  async prontaParaContrato(propostaId) {
    const { data, error } = await supabase.rpc('proposta_pronta_para_contrato', { p_proposta: propostaId });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return { pronta: !!row?.pronta, motivos: row?.motivos || [] };
  },
  async create(proposta) {
    const { data, error } = await supabase.from('propostas').insert(proposta).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('propostas').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from('propostas').delete().eq('id', id);
    if (error) throw error;
  },
};
