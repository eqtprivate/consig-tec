import { supabase } from '@/lib/supabaseClient';

export const parcelasApi = {
  async listByContrato(contratoId) {
    const { data, error } = await supabase
      .from('parcelas')
      .select('*')
      .eq('contrato_id', contratoId)
      .order('numero');
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('parcelas').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async criarLote(parcelas) {
    const { data, error } = await supabase.from('parcelas').insert(parcelas).select();
    if (error) throw error;
    return data;
  },
  // Estágio 6 — motor de PMT no banco
  async gerarCronograma(contratoId) {
    const { data, error } = await supabase.rpc('gerar_cronograma_contrato', { p_contrato: contratoId });
    if (error) throw error;
    return data; // nº de parcelas geradas (0 se já existiam)
  },
  async simularPmt(principal, taxaMensal, prazo, dataBase) {
    const { data, error } = await supabase.rpc('simular_pmt', {
      p_principal: principal, p_taxa_mensal: taxaMensal, p_prazo: prazo,
      ...(dataBase ? { p_data_base: dataBase } : {}),
    });
    if (error) throw error;
    return data; // [{ numero, vencimento, valor, juros, amortizacao, saldo }]
  },
};

