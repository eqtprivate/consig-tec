import { supabase } from '@/lib/supabaseClient';

export const auditoriaApi = {
  async list(filters = {}) {
    let query = supabase
      .from('auditoria')
      .select('*, usuario:usuarios(nome)')
      .order('created_at', { ascending: false });

    if (filters.acao) query = query.ilike('acao', `%${filters.acao}%`);
    if (filters.entidade) query = query.ilike('entidade', `%${filters.entidade}%`);
    if (filters.usuario_id) query = query.eq('usuario_id', filters.usuario_id);

    const { data, error } = await query.limit(200);
    if (error) throw error;
    return data;
  },
  async log(acao, entidade, registroId, valorNovo) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('auditoria').insert({
        usuario_id: user.id,
        acao,
        entidade,
        registro_id: registroId != null ? String(registroId) : null,
        valor_novo: valorNovo || null,
      });
    } catch {
      // Auditoria é best-effort — não bloqueia a operação principal
    }
  },
};