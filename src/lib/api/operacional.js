import { supabase } from '@/lib/supabaseClient';

export const cobrancasApi = {
  async list(filters = {}) {
    let q = supabase.from('cobrancas')
      .select('*, contrato:contratos(numero_contrato, cliente:clientes(nome))')
      .order('created_at', { ascending: false });
    if (filters.franquia_id) q = q.eq('franquia_id', filters.franquia_id);
    if (filters.status) q = q.eq('status', filters.status);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  },
  async create(item) { const { data, error } = await supabase.from('cobrancas').insert(item).select().single(); if (error) throw error; return data; },
  async update(id, u) { const { data, error } = await supabase.from('cobrancas').update(u).eq('id', id).select().single(); if (error) throw error; return data; },
  // Gera cobranças a partir das parcelas atrasadas (Estágio 11).
  async gerarInadimplencia() {
    const { data, error } = await supabase.rpc('gerar_cobrancas_inadimplencia');
    if (error) throw error;
    return data; // nº de cobranças criadas
  },
};

export const chamadosApi = {
  async list(filters = {}) {
    let q = supabase.from('chamados')
      .select('*, cliente:clientes(nome), responsavel:usuarios(nome)')
      .order('created_at', { ascending: false });
    if (filters.tipo) q = q.eq('tipo', filters.tipo);
    if (filters.status) q = q.eq('status', filters.status);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  },
  async create(item) { const { data, error } = await supabase.from('chamados').insert(item).select().single(); if (error) throw error; return data; },
  async update(id, u) { const { data, error } = await supabase.from('chamados').update(u).eq('id', id).select().single(); if (error) throw error; return data; },
};

export const lgpdApi = {
  async list() { const { data, error } = await supabase.from('lgpd_solicitacoes').select('*').order('created_at', { ascending: false }); if (error) throw error; return data; },
  async create(item) { const { data, error } = await supabase.from('lgpd_solicitacoes').insert(item).select().single(); if (error) throw error; return data; },
  async update(id, u) { const { data, error } = await supabase.from('lgpd_solicitacoes').update(u).eq('id', id).select().single(); if (error) throw error; return data; },
};
