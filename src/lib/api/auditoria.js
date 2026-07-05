import { supabase } from '@/lib/supabaseClient';

export const auditoriaApi = {
  async list(filters = {}) {
    let query = supabase
      .from('logs_auditoria')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.acao) query = query.ilike('acao', `%${filters.acao}%`);
    if (filters.entidade) query = query.eq('entidade', filters.entidade);
    if (filters.usuario_id) query = query.eq('usuario_id', filters.usuario_id);

    const { data, error } = await query.limit(200);
    if (error) throw error;
    return data;
  },
  async log(acao, entidade, entidadeId, detalhes) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: perfil } = await supabase
        .from('usuarios')
        .select('id, nome')
        .eq('auth_user_id', user.id)
        .single();
      if (!perfil) return;
      await supabase.from('logs_auditoria').insert({
        usuario_id: perfil.id,
        usuario_nome: perfil.nome,
        acao,
        entidade,
        entidade_id: entidadeId,
        detalhes: detalhes || null,
      });
    } catch {
      // Auditoria é best-effort — não bloqueia a operação principal
    }
  },
};