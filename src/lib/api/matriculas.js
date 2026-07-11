import { supabase } from '@/lib/supabaseClient';

const SELECT = '*, convenio:convenios(id, nome, tipo_margem, percentual_margem_apartada, ativo)';

export const matriculasApi = {
  async list(filters = {}) {
    let query = supabase.from('matriculas').select(SELECT).order('created_at', { ascending: false });
    if (filters.cliente_id) query = query.eq('cliente_id', filters.cliente_id);
    if (filters.convenio_id) query = query.eq('convenio_id', filters.convenio_id);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  async create(matricula) {
    const { data, error } = await supabase.from('matriculas').insert(matricula).select(SELECT).single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('matriculas').update(updates).eq('id', id).select(SELECT).single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from('matriculas').delete().eq('id', id);
    if (error) throw error;
  },
};

// Elegibilidade do cartão benefício (mesma regra da função SQL
// matricula_elegivel_cartao) para uso imediato na UI, sem round-trip.
export function elegivelCartaoBeneficio(m) {
  const situacaoOk = ['ativo', 'aposentado', 'pensionista'].includes(m.situacao);
  const convOk = m.convenio && m.convenio.ativo !== false &&
    ['apartada', 'cartao'].includes(m.convenio.tipo_margem);
  const margemOk = Number(m.margem_disponivel || 0) > 0;
  return situacaoOk && convOk && margemOk;
}
