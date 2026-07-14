import { supabase } from '@/lib/supabaseClient';
import { getEmpresaView } from '@/lib/tenantView';

export const conveniosApi = {
  async list() {
    let q = supabase
      .from('convenios')
      .select('*, empresa:empresas(*), entidade:entidades_cadastro(*), overlay:overlay_comercial_convenio(*)')
      .order('nome');
    const ev = getEmpresaView();          // superadmin "ver como" empresa X
    if (ev) q = q.eq('empresa_id', ev);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  },
  async create(convenio) {
    const ev = getEmpresaView();  // superadmin em foco: cadastra na empresa selecionada
    const payload = ev && convenio.empresa_id == null ? { ...convenio, empresa_id: ev } : convenio;
    const { data, error } = await supabase.from('convenios').insert(payload).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('convenios').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from('convenios').delete().eq('id', id);
    if (error) throw error;
  },
  // Upsert por chave externa da PixConsig — usado no import CSV/espelho.
  async upsertByPixconsig(convenio) {
    const { data, error } = await supabase
      .from('convenios')
      .upsert(convenio, { onConflict: 'pixconsig_convenio_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
