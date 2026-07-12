import { supabase } from '@/lib/supabaseClient';

// Visão executiva consolidada da esteira (grupo) — função dashboard_executivo.
export const dashboardApi = {
  async executivo() {
    const { data, error } = await supabase.rpc('dashboard_executivo');
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  },
  async contadores() {
    const { data, error } = await supabase.rpc('contadores_operacionais');
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  },
  async evolucaoMensal(meses = 6) {
    const { data, error } = await supabase.rpc('evolucao_mensal', { p_meses: meses });
    if (error) throw error;
    return data;
  },
  async rankingConvenios(limite = 8) {
    const { data, error } = await supabase.rpc('ranking_convenios_producao', { p_limite: limite });
    if (error) throw error;
    return data;
  },
};
