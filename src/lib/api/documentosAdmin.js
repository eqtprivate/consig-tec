import { supabase } from '@/lib/supabaseClient';

// Documentos confidenciais de superadmin. A LEITURA de um documento passa pela
// RPC get_documento_admin (SECURITY DEFINER) que grava trilha em logs_acesso —
// por isso o conteúdo NÃO vem no list(), só ao abrir. RLS libera só superadmin.
export const documentosAdminApi = {
  async list() {
    const { data, error } = await supabase.from('documentos_admin')
      .select('id, titulo, categoria, confidencial, ordem, updated_at')
      .order('ordem', { ascending: true })
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  // Leitura auditada — grava quem abriu.
  async get(id) {
    const { data, error } = await supabase.rpc('get_documento_admin', { p_id: id });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  },
  async salvar({ id, titulo, categoria, conteudo, confidencial = true }) {
    const { data, error } = await supabase.rpc('salvar_documento_admin', {
      p_id: id ?? null, p_titulo: titulo, p_categoria: categoria || 'briefing',
      p_conteudo: conteudo, p_confidencial: confidencial,
    });
    if (error) throw error;
    return data; // id
  },
};
