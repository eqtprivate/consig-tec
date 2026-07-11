import { supabase } from '@/lib/supabaseClient';

export const entidadesApi = {
  async list() {
    const { data, error } = await supabase.from('entidades_cadastro').select('*').order('nome');
    if (error) throw error;
    return data;
  },
  async create(entidade) {
    const { data, error } = await supabase.from('entidades_cadastro').insert(entidade).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('entidades_cadastro').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  // Localiza uma entidade por CNPJ (ou nome+cidade+uf) — usado no import CSV.
  async encontrar({ cnpj, nome, cidade, uf }) {
    if (cnpj) {
      const { data } = await supabase.from('entidades_cadastro').select('id').eq('cnpj', cnpj).limit(1);
      if (data && data[0]) return data[0].id;
    }
    if (nome) {
      let q = supabase.from('entidades_cadastro').select('id').eq('nome', nome);
      if (cidade) q = q.eq('cidade', cidade);
      if (uf) q = q.eq('uf', uf);
      const { data } = await q.limit(1);
      if (data && data[0]) return data[0].id;
    }
    return null;
  },
};
