import { supabase } from '@/lib/supabaseClient';

export const notificacoesApi = {
  async list() {
    const { data, error } = await supabase.from('notificacoes').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    return data;
  },
  async recentes(limit = 15) {
    const { data, error } = await supabase
      .from('notificacoes')
      .select('id, evento, assunto, status_envio, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },
  async enqueue(item) {
    const { data, error } = await supabase.from('notificacoes').insert(item).select().single();
    if (error) throw error;
    return data;
  },
  async dispatch(payload = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/functions/dispatchNotificacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Falha ao processar fila');
    return data;
  },
  // Envio DB-nativo (Resend via pg_net) — mesmo caminho do cron.
  async dispatchDb() {
    const { data, error } = await supabase.rpc('dispatch_notificacoes_admin');
    if (error) throw error;
    return data; // nº de notificações enviadas
  },
};

export const regrasNotificacaoApi = {
  async list() {
    const { data, error } = await supabase.from('regras_notificacao').select('*').order('evento');
    if (error) throw error;
    return data;
  },
  async create(item) {
    const { data, error } = await supabase.from('regras_notificacao').insert(item).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('regras_notificacao').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
};
