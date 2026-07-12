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

export const interacoesApi = {
  async list(filters = {}) {
    let q = supabase.from('interacoes')
      .select('*, operador:usuarios(nome)')
      .order('created_at', { ascending: false });
    if (filters.lead_id) q = q.eq('lead_id', filters.lead_id);
    if (filters.oportunidade_id) q = q.eq('oportunidade_id', filters.oportunidade_id);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  },
  async create(item) {
    const { data, error } = await supabase.from('interacoes').insert(item).select().single();
    if (error) throw error;
    return data;
  },
};

export const oportunidadesApi = {
  async list(filters = {}) {
    let q = supabase.from('oportunidades')
      .select('*, lead:leads(nome, telefone, cpf), cliente:clientes(nome, cpf), convenio:convenios(nome, taxa_mensal, tipo_margem), operador:usuarios(nome)')
      .order('created_at', { ascending: false });
    if (filters.franquia_id) q = q.eq('franquia_id', filters.franquia_id);
    if (filters.etapa) q = q.eq('etapa', filters.etapa);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  },
  async create(item) {
    const { data, error } = await supabase.from('oportunidades').insert(item).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('oportunidades').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  // Simula PMT (tabela Price) sem persistir — reusa a função do banco.
  async simular(principal, taxaMensal, prazo) {
    const { data, error } = await supabase.rpc('calcular_pmt', {
      p_principal: principal, p_taxa_mensal: taxaMensal, p_prazo: prazo,
    });
    if (error) throw error;
    return data; // valor da parcela
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
