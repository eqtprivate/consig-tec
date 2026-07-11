import { supabase } from '@/lib/supabaseClient';

const SELECT =
  '*, proposta:propostas(id, valor_solicitado, cliente:clientes(nome, cpf)), ' +
  'contrato:contratos(id, numero_contrato, cliente:clientes(nome)), ' +
  'antifraude:analises_antifraude(*)';

export const formalizacoesApi = {
  async list(filters = {}) {
    let query = supabase.from('formalizacoes').select(SELECT).order('created_at', { ascending: false });
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.proposta_id) query = query.eq('proposta_id', filters.proposta_id);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  async create(item) {
    const { data, error } = await supabase.from('formalizacoes').insert(item).select(SELECT).single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('formalizacoes').update(updates).eq('id', id).select(SELECT).single();
    if (error) throw error;
    return data;
  },
  async registrarAntifraude(analise) {
    const { data, error } = await supabase.from('analises_antifraude').insert(analise).select().single();
    if (error) throw error;
    return data;
  },
};
