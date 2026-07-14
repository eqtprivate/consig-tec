import { supabase } from '@/lib/supabaseClient';
import { getEmpresaView } from '@/lib/tenantView';

// Conciliação de folha (BPORetorno): importa o arquivo de retorno e concilia
// contra a expectativa (parcelas) via RPC conciliar_retorno.
export const conciliacaoApi = {
  async listRetornos() {
    let q = supabase.from('retornos_folha')
      .select('*, convenio:convenios(nome)')
      .order('created_at', { ascending: false });
    const ev = getEmpresaView(); if (ev) q = q.eq('empresa_id', ev);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  },

  async criarRetorno({ convenio_id, competencia, arquivo_nome, itens }) {
    const ev = getEmpresaView();
    const header = {
      convenio_id: convenio_id || null, competencia, arquivo_nome: arquivo_nome || null,
      total_itens: itens.length,
      total_valor: itens.reduce((s, i) => s + Number(i.valor_descontado || 0), 0),
    };
    if (ev) header.empresa_id = ev; // superadmin em foco: grava na empresa selecionada
    const { data: r, error } = await supabase.from('retornos_folha').insert(header).select().single();
    if (error) throw error;
    if (itens.length) {
      const rows = itens.map((i) => ({
        retorno_id: r.id, empresa_id: r.empresa_id, cpf: i.cpf || null,
        matricula: i.matricula || null, valor_descontado: Number(i.valor_descontado || 0), motivo: i.motivo || null,
      }));
      for (let k = 0; k < rows.length; k += 500) {
        const { error: e2 } = await supabase.from('retorno_itens').insert(rows.slice(k, k + 500));
        if (e2) throw e2;
      }
    }
    return r;
  },

  async conciliar(retornoId) {
    const { data, error } = await supabase.rpc('conciliar_retorno', { p_retorno: retornoId });
    if (error) throw error;
    return data; // { tipo: count }
  },

  async ocorrencias(retornoId, tipo) {
    let q = supabase.from('conciliacao_ocorrencias')
      .select('*, cliente:clientes(nome)')
      .eq('retorno_id', retornoId)
      .order('diferenca', { ascending: true });
    if (tipo && tipo !== 'todos') q = q.eq('tipo', tipo);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  },

  async tratar(id, status) {
    const { data, error } = await supabase.from('conciliacao_ocorrencias').update({ status }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async removerRetorno(id) {
    const { error } = await supabase.from('retornos_folha').delete().eq('id', id);
    if (error) throw error;
  },
};
