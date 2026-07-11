import { supabase } from '@/lib/supabaseClient';

function crud(table, select = '*') {
  return {
    async list() { const { data, error } = await supabase.from(table).select(select).order('created_at', { ascending: false }); if (error) throw error; return data; },
    async create(item) { const { data, error } = await supabase.from(table).insert(item).select(select).single(); if (error) throw error; return data; },
    async update(id, u) { const { data, error } = await supabase.from(table).update(u).eq('id', id).select(select).single(); if (error) throw error; return data; },
  };
}

export const carteirasApi = crud('carteiras_adquiridas');
export const integracoesApi = crud('integracoes');
export const refinApi = crud('refinanciamentos', '*, contrato:contratos(numero_contrato, cliente:clientes(nome)), cliente:clientes(nome)');
