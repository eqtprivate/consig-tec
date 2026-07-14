import { supabase } from '@/lib/supabaseClient';
import { getEmpresaView } from '@/lib/tenantView';

// Visão executiva consolidada da esteira (grupo) — função dashboard_executivo.
export const dashboardApi = {
  async executivo() {
    const { data, error } = await supabase.rpc('dashboard_executivo', { p_empresa: getEmpresaView() });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  },
  async contadores() {
    const { data, error } = await supabase.rpc('contadores_operacionais', { p_empresa: getEmpresaView() });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  },
  async evolucaoMensal(meses = 6) {
    const { data, error } = await supabase.rpc('evolucao_mensal', { p_meses: meses, p_empresa: getEmpresaView() });
    if (error) throw error;
    return data;
  },
  async rankingConvenios(limite = 8) {
    const { data, error } = await supabase.rpc('ranking_convenios_producao', { p_limite: limite, p_empresa: getEmpresaView() });
    if (error) throw error;
    return data;
  },
};
