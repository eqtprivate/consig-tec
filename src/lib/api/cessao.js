import { supabase } from '@/lib/supabaseClient';

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
};
