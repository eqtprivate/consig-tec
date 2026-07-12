import { supabase } from '@/lib/supabaseClient';

export const produtosConvenioApi = {
  async list(filters = {}) {
    let q = supabase.from('produtos_convenio').select('*, convenio:convenios(id, nome)').order('produto');
    if (filters.convenio_id) q = q.eq('convenio_id', filters.convenio_id);
    if (filters.ativo != null) q = q.eq('ativo', filters.ativo);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  },
  async create(item) { const { data, error } = await supabase.from('produtos_convenio').insert(item).select().single(); if (error) throw error; return data; },
  async update(id, u) { const { data, error } = await supabase.from('produtos_convenio').update(u).eq('id', id).select().single(); if (error) throw error; return data; },
  async remove(id) { const { error } = await supabase.from('produtos_convenio').delete().eq('id', id); if (error) throw error; },
  // Valor máximo financiável dada a margem mensal (PMT inverso, no banco)
  async valorMaximo(margem, taxaMensal, prazo) {
    const { data, error } = await supabase.rpc('valor_maximo_por_margem', { p_margem: margem, p_taxa_mensal: taxaMensal, p_prazo: prazo });
    if (error) throw error;
    return data;
  },
  // Parcela (PMT) de um valor — reusa calcular_pmt
  async parcela(principal, taxaMensal, prazo) {
    const { data, error } = await supabase.rpc('calcular_pmt', { p_principal: principal, p_taxa_mensal: taxaMensal, p_prazo: prazo });
    if (error) throw error;
    return data;
  },
};
