import { supabase } from '@/lib/supabaseClient';

const SELECT =
  '*, contrato:contratos(*, cliente:clientes(*)), convenio:convenios(*), ' +
  'proposta:propostas(*, cliente:clientes(nome, cpf)), matricula:matriculas(matricula, orgao)';

export const averbacoesApi = {
  async list(filters = {}) {
    let query = supabase.from('averbacoes').select(SELECT).order('created_at', { ascending: false });
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.contrato_id) query = query.eq('contrato_id', filters.contrato_id);
    if (filters.proposta_id) query = query.eq('proposta_id', filters.proposta_id);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  async create(averbacao) {
    const { data, error } = await supabase.from('averbacoes').insert(averbacao).select(SELECT).single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('averbacoes').update(updates).eq('id', id).select(SELECT).single();
    if (error) throw error;
    return data;
  },
  // Reconciliação reservado × averbado por proposta (Estágio 4).
  async reconciliacao() {
    const { data, error } = await supabase.rpc('reconciliacao_margem');
    if (error) throw error;
    return data; // [{ proposta_id, cliente, convenio, matricula, valor_reservado, status_reserva, valor_averbado, status_averbacao, divergencia }]
  },
};
