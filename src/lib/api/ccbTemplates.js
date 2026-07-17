import { supabase } from '@/lib/supabaseClient';

// Padrões (templates) de CCB: cada emissor tem um layout; o padrão define QUAIS
// páginas do PDF a IA deve ler. RLS já restringe o escopo (globais + da empresa;
// superadmin vê tudo). Ver migração 0098_ccb_templates.sql.
export const ccbTemplatesApi = {
  // Padrões ATIVOS disponíveis (para o seletor no upload).
  async listAtivos() {
    const { data, error } = await supabase.from('ccb_templates')
      .select('*').eq('ativo', true).order('nome');
    if (error) throw error;
    return data || [];
  },
  // Todos (para a tela de gestão) — RLS filtra pelo que o usuário pode ver.
  async listTodos() {
    const { data, error } = await supabase.from('ccb_templates')
      .select('*').order('nome');
    if (error) throw error;
    return data || [];
  },
  async create({ nome, descricao, paginas, empresa_id }) {
    const payload = {
      nome: (nome || '').trim(),
      descricao: descricao || null,
      paginas: Array.isArray(paginas) ? paginas : [],
      empresa_id: empresa_id ?? null,
    };
    const { data, error } = await supabase.from('ccb_templates').insert(payload).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('ccb_templates').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from('ccb_templates').delete().eq('id', id);
    if (error) throw error;
  },
};

// "1,2,13,14,15" → [1,2,13,14,15]  (e o inverso, p/ inputs de texto).
export const paginasFromStr = (s) => String(s || '')
  .split(',').map((x) => Number(x.trim())).filter((n) => Number.isFinite(n) && n > 0);
export const paginasToStr = (arr) => (Array.isArray(arr) ? arr.join(', ') : '');
