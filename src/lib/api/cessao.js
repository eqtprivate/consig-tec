import { supabase } from '@/lib/supabaseClient';
import { getEmpresaView } from '@/lib/tenantView';

// Fábrica de CRUD simples para as entidades de cadastro da cessão.
function crud(table, select = '*', order = 'created_at') {
  return {
    async list() {
      const { data, error } = await supabase.from(table).select(select).order(order, { ascending: false });
      if (error) throw error;
      return data;
    },
    async create(item) {
      const { data, error } = await supabase.from(table).insert(item).select(select).single();
      if (error) throw error;
      return data;
    },
    async update(id, updates) {
      const { data, error } = await supabase.from(table).update(updates).eq('id', id).select(select).single();
      if (error) throw error;
      return data;
    },
    async remove(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
  };
}

export const gestorasApi = crud('gestoras', '*', 'nome');
export const administradorasApi = crud('administradoras', '*', 'nome');
export const cedentesApi = crud('cedentes', '*', 'nome');
export const fundosApi = crud('fundos', '*, gestora:gestoras(id, nome), administradora:administradoras(id, nome)', 'nome');
export const pddApi = crud('pdd_carteira', '*, fundo:fundos(id, nome)', 'competencia');

export const termosCessaoApi = {
  ...crud('termos_cessao', '*, fundo:fundos(id, nome), cedente:cedentes(id, nome)'),
  async itens(termoId) {
    const { data, error } = await supabase
      .from('itens_cessao')
      .select('*, ccb:ccbs(id, numero)')
      .eq('termo_id', termoId)
      .order('created_at');
    if (error) throw error;
    return data;
  },
  async addItem(item) {
    const { data, error } = await supabase.from('itens_cessao').insert(item).select('*, ccb:ccbs(id, numero)').single();
    if (error) throw error;
    return data;
  },
  async removeItem(id) {
    const { error } = await supabase.from('itens_cessao').delete().eq('id', id);
    if (error) throw error;
  },
  // Monta o lastro com os títulos elegíveis (CCB assinada, contrato ativo) — Estágio 8.
  async montarLastro(termoId) {
    const { data, error } = await supabase.rpc('montar_lastro_cessao', { p_termo: termoId });
    if (error) throw error;
    return data; // nº de títulos adicionados
  },
  // Item 6 — deságio por lote (KPI de topo).
  async desagioPorLote() {
    const { data, error } = await supabase.rpc('desagio_por_lote', { p_empresa: getEmpresaView() });
    if (error) throw error;
    return data || [];
  },
  // Item 6 — bordereau / arquivo de remessa do lote (linhas dos títulos).
  async bordereau(termoId) {
    const { data, error } = await supabase.rpc('bordereau_termo', { p_termo: termoId });
    if (error) throw error;
    return data || [];
  },
  // Item 6 — recompra de um título (só pro solvendo); marca parcelas 'recomprada'.
  async recomprarItem(itemId) {
    const { error } = await supabase.rpc('recomprar_item_cessao', { p_item: itemId });
    if (error) throw error;
  },
};

// Item 6 — gera o CSV do bordereau (formato de remessa p/ administrador do fundo).
export function bordereauToCsv(linhas) {
  const head = ['titulo', 'emitente', 'cpf_cnpj', 'vencimento', 'valor', 'agio_desagio', 'ccb_numero', 'recompravel'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = (linhas || []).map((l) => head.map((k) => esc(l[k])).join(';'));
  return [head.join(';'), ...rows].join('\n');
}
