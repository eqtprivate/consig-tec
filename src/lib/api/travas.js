import { supabase } from '@/lib/supabaseClient';

// Item 5 — motor de travas + relógio dos 30 dias + consentimento por operação.
export const travasApi = {
  // Checklist de travas de uma operação (proposta): { bloqueia, travas:[{codigo,ok,motivo}] }.
  async avaliar(propostaId) {
    const { data, error } = await supabase.rpc('avaliar_travas_operacao', { p_proposta: propostaId });
    if (error) throw error;
    return data;
  },
  // Averbações averbadas a expirar (30 dias) sem CCB emitida.
  async relogioMargem(alertaDias = 5, prazoDias = 30) {
    const { data, error } = await supabase.rpc('relogio_margem', { p_alerta_dias: alertaDias, p_prazo_dias: prazoDias });
    if (error) throw error;
    return data || [];
  },
  // Consentimento por operação (data, canal, forma).
  async registrarConsentimento({ propostaId, titularRef, canal, forma, versaoTermo = 'v1' }) {
    const { data, error } = await supabase.from('consentimentos').insert({
      proposta_id: propostaId, titular_ref: titularRef || null,
      tipo: 'operacao_credito', canal, forma, versao_termo: versaoTermo,
    }).select().single();
    if (error) throw error;
    return data;
  },
};
