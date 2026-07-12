import { supabase } from '@/lib/supabaseClient';

const SELECT =
  '*, solicitante:usuarios!solicitante_id(id, nome), ' +
  'responsavel:usuarios!responsavel_id(id, nome), area:areas(id, nome, codigo)';

export const threadsApi = {
  async list(filters = {}) {
    let q = supabase.from('threads').select(SELECT).order('updated_at', { ascending: false });
    if (filters.status) q = q.eq('status', filters.status);
    if (filters.responsavel_id) q = q.eq('responsavel_id', filters.responsavel_id);
    if (filters.solicitante_id) q = q.eq('solicitante_id', filters.solicitante_id);
    if (filters.entidade_ref) q = q.eq('entidade_ref', filters.entidade_ref);
    if (filters.registro_id) q = q.eq('registro_id', filters.registro_id);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  },
  async get(id) {
    const { data, error } = await supabase.from('threads').select(SELECT).eq('id', id).single();
    if (error) throw error;
    return data;
  },
  // Abertura via função (define solicitante = auth.uid()).
  async abrir(p) {
    const { data, error } = await supabase.rpc('abrir_thread', {
      p_tipo: p.tipo, p_categoria: p.categoria || null, p_titulo: p.titulo, p_descricao: p.descricao || null,
      p_entidade_ref: p.entidade_ref, p_registro_id: String(p.registro_id), p_area: p.area_id,
      p_empresa: p.empresa_id || null, p_franquia: p.franquia_id || null,
      p_responsavel: p.responsavel_id || null, p_prioridade: p.prioridade || 'media',
      p_requer_validacao: !!p.requer_validacao, p_prazo_sla: p.prazo_sla || null,
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('threads').update(updates).eq('id', id).select(SELECT).single();
    if (error) throw error;
    return data;
  },

  async mensagens(threadId) {
    const { data, error } = await supabase
      .from('mensagens')
      .select('*, autor:usuarios(id, nome)')
      .eq('thread_id', threadId)
      .order('created_at');
    if (error) throw error;
    return data;
  },
  async enviarMensagem(threadId, corpo, mencoes = []) {
    const { data, error } = await supabase
      .from('mensagens')
      .insert({ thread_id: threadId, corpo, tipo: 'humana', mencoes })
      .select('*, autor:usuarios(id, nome)')
      .single();
    if (error) throw error;
    return data;
  },
  async softDeleteMensagem(id, motivo) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('mensagens')
      .update({ deletado_em: new Date().toISOString(), deletado_por: user?.id || null, motivo_delecao: motivo || null })
      .eq('id', id);
    if (error) throw error;
  },

  async participantes(threadId) {
    const { data, error } = await supabase
      .from('thread_participantes')
      .select('*, usuario:usuarios(id, nome)')
      .eq('thread_id', threadId);
    if (error) throw error;
    return data;
  },
  async addParticipante(threadId, usuarioId) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('thread_participantes')
      .insert({ thread_id: threadId, usuario_id: usuarioId, adicionado_por: user?.id || null });
    if (error) throw error;
  },
  async removeParticipante(threadId, usuarioId) {
    const { error } = await supabase.from('thread_participantes').delete().eq('thread_id', threadId).eq('usuario_id', usuarioId);
    if (error) throw error;
  },

  async validar(threadId, aprovado, observacao) {
    const { error } = await supabase.from('validacoes_thread')
      .insert({ thread_id: threadId, aprovado, observacao: observacao || null });
    if (error) throw error;
  },
  async validacoes(threadId) {
    const { data, error } = await supabase.from('validacoes_thread')
      .select('*, validador:usuarios(id, nome)').eq('thread_id', threadId).order('created_at');
    if (error) throw error;
    return data;
  },
};
