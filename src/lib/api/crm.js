import { supabase } from '@/lib/supabaseClient';
import { getFranquiasView } from '@/lib/tenantView';

export const leadsApi = {
  async list(filters = {}) {
    let query = supabase.from('leads')
      .select('*, campanha:campanhas(id, nome), responsavel:usuarios(nome), convenio:convenios(id, nome, prioridade_comercial)')
      .order('created_at', { ascending: false });
    if (filters.franquia_id) query = query.eq('franquia_id', filters.franquia_id);
    const __fv = getFranquiasView(); if (__fv) query = query.in('franquia_id', __fv);
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
  async createMany(items) {
    const { data, error } = await supabase.from('leads').insert(items).select('id');
    if (error) throw error;
    return data;
  },
};

export const metasApi = {
  async list(filters = {}) {
    let q = supabase.from('metas_operador').select('*, operador:usuarios(nome)').order('competencia', { ascending: false });
    if (filters.competencia) q = q.eq('competencia', filters.competencia);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  },
  async create(item) { const { data, error } = await supabase.from('metas_operador').insert(item).select().single(); if (error) throw error; return data; },
  async update(id, u) { const { data, error } = await supabase.from('metas_operador').update(u).eq('id', id).select().single(); if (error) throw error; return data; },
};

export const produtividadeApi = {
  async periodo(de, ate) {
    const { data, error } = await supabase.rpc('produtividade_callcenter', { p_de: de, p_ate: ate });
    if (error) throw error;
    return data;
  },
};

export const metasComerciaisApi = {
  async list(filters = {}) {
    let q = supabase.from('metas_comerciais').select('*, convenio:convenios(id, nome), responsavel:usuarios(nome)').order('competencia', { ascending: false });
    if (filters.competencia) q = q.eq('competencia', filters.competencia);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  },
  async create(item) { const { data, error } = await supabase.from('metas_comerciais').insert(item).select().single(); if (error) throw error; return data; },
  async update(id, u) { const { data, error } = await supabase.from('metas_comerciais').update(u).eq('id', id).select().single(); if (error) throw error; return data; },
  async remove(id) { const { error } = await supabase.from('metas_comerciais').delete().eq('id', id); if (error) throw error; },
  async realizado(competencia) {
    const { data, error } = await supabase.rpc('realizado_comercial', { p_competencia: competencia });
    if (error) throw error;
    return data; // [{ convenio_id, vendas, valor }]
  },
};

export const motivosPerdaApi = {
  async list() {
    const { data, error } = await supabase.from('motivos_perda').select('*').eq('ativo', true).order('ordem');
    if (error) throw error;
    return data;
  },
  async listAll() {
    const { data, error } = await supabase.from('motivos_perda').select('*').order('ordem');
    if (error) throw error;
    return data;
  },
  async create(item) { const { data, error } = await supabase.from('motivos_perda').insert(item).select().single(); if (error) throw error; return data; },
  async update(id, u) { const { data, error } = await supabase.from('motivos_perda').update(u).eq('id', id).select().single(); if (error) throw error; return data; },
  async remove(id) { const { error } = await supabase.from('motivos_perda').delete().eq('id', id); if (error) throw error; },
};

export const roteiroApi = {
  async list() {
    const { data, error } = await supabase.from('roteiro_scripts').select('*').eq('ativo', true).order('ordem');
    if (error) throw error;
    return data;
  },
  async listAll() {
    const { data, error } = await supabase.from('roteiro_scripts').select('*').order('categoria').order('ordem');
    if (error) throw error;
    return data;
  },
  async create(item) { const { data, error } = await supabase.from('roteiro_scripts').insert(item).select().single(); if (error) throw error; return data; },
  async update(id, u) { const { data, error } = await supabase.from('roteiro_scripts').update(u).eq('id', id).select().single(); if (error) throw error; return data; },
  async remove(id) { const { error } = await supabase.from('roteiro_scripts').delete().eq('id', id); if (error) throw error; },
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
    const __fv = getFranquiasView(); if (__fv) q = q.in('franquia_id', __fv);
    if (filters.etapa) q = q.eq('etapa', filters.etapa);
    if (filters.cliente_id) q = q.eq('cliente_id', filters.cliente_id);
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
  // Oportunidades perdidas no período (para relatório de perdas por motivo)
  async perdas(de, ate) {
    const { data, error } = await supabase.from('oportunidades')
      .select('valor_estimado, motivo:motivos_perda(nome)')
      .eq('etapa', 'perdida')
      .gte('created_at', de).lte('created_at', `${ate}T23:59:59`);
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
    const __fv = getFranquiasView(); if (__fv) query = query.in('franquia_id', __fv);
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
