import { supabase } from '@/lib/supabaseClient';
import { getEmpresaView } from '@/lib/tenantView';

// Capacidade por município/convênio: margem apartada elegível disponível,
// tomadores e vínculos elegíveis (função capacidade_por_convenio no banco).
export const capacidadeApi = {
  async porConvenio() {
    const { data, error } = await supabase.rpc('capacidade_por_convenio', { p_empresa: getEmpresaView() });
    if (error) throw error;
    return data; // [{ convenio_id, nome, cidade, uf, prioridade_comercial, potencial_vendas, ativo, tomadores, vinculos_elegiveis, margem_disponivel, margem_utilizada, ticket_medio_margem }]
  },
};
