import { supabase } from '@/lib/supabaseClient';

export const usuariosApi = {
  async list() {
    const { data, error } = await supabase.from('usuarios').select('*, empresa:empresas(id, nome)').order('nome');
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
  // Edição do PRÓPRIO perfil (nome/telefone/cpf) — RPC segura (não toca role/empresa).
  async atualizarMeuPerfil({ nome, telefone, cpf }) {
    const { data, error } = await supabase.rpc('atualizar_meu_perfil', {
      p_nome: nome, p_telefone: telefone ?? null, p_cpf: cpf ?? null,
    });
    if (error) throw error;
    return data;
  },
  async _callFunction(fn, payload) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/functions/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token || ''}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Operação falhou');
    return data;
  },
  // Cria um usuário via função backend (usa service_role no servidor).
  // Retorna { id, email, role, senha, emailEnviado }.
  async criar({ nome, email, password, role, gerarSenha, enviarEmail, empresa_id }) {
    return this._callFunction('criarUsuario', { nome, email, password, role, gerarSenha, enviarEmail, empresa_id });
  },
  // Ações administrativas: reset_senha | ativar | desativar | excluir
  async adminAction(action, usuarioId, opts = {}) {
    return this._callFunction('adminUsuario', { action, usuarioId, ...opts });
  },
};
