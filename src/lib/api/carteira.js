import { supabase } from '@/lib/supabaseClient';
import { getEmpresaView } from '@/lib/tenantView';

// Item 7 — métricas reais da carteira + import histórico (CSV → jsonb).
export const carteiraApi = {
  // KPIs: VOP, VF, VF/VOP, ticket médio, prazo médio, PDD, deságio médio.
  async metricas() {
    const { data, error } = await supabase.rpc('metricas_carteira', { p_empresa: getEmpresaView() });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  },
  // Importa contratos históricos em lote. Recebe array de objetos já parseados
  // do CSV. Devolve { inseridos, total, erros:[{linha, motivo}] }.
  async importarHistorico(linhas) {
    const { data, error } = await supabase.rpc('importar_contratos_historicos', {
      p_linhas: linhas, p_empresa: getEmpresaView(),
    });
    if (error) throw error;
    return data;
  },
};

// Parse simples de CSV (cabeçalho + ; ou ,) → array de objetos. Colunas
// esperadas: numero_contrato, cpf, nome, convenio, valor_principal, valor_total,
// prazo, taxa_mensal, valor_parcela, data_assinatura, status.
export function parseContratosCsv(texto) {
  const linhas = String(texto || '').trim().split(/\r?\n/).filter(Boolean);
  if (linhas.length < 2) return [];
  const sep = linhas[0].includes(';') ? ';' : ',';
  const cols = linhas[0].split(sep).map((c) => c.trim().toLowerCase());
  return linhas.slice(1).map((l) => {
    const vals = l.split(sep);
    const o = {};
    cols.forEach((c, i) => { o[c] = (vals[i] ?? '').trim(); });
    return o;
  });
}
