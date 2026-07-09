import { supabase } from '@/lib/supabaseClient';

export const usuariosApi = {
  async list() {
    const { data, error } = await supabase.from('usuarios').select('*').order('nome');
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('usuarios').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from('usuarios').delete().eq('id', id);
    if (error) throw error;
  },
  // Cria um usuário via função backend (usa service_role no servidor).
  async criar({ nome, email, password, role }) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/functions/criarUsuario', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token || ''}`,
      },
      body: JSON.stringify({ nome, email, password, role }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Falha ao criar usuário');
    return data;
  },
};
