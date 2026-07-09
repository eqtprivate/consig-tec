import { supabase } from '@/lib/supabaseClient';

export const parcelasApi = {
  async listByContrato(contratoId) {
    const { data, error } = await supabase
      .from('parcelas')
      .select('*')
      .eq('contrato_id', contratoId)
      .order('numero');
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('parcelas').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
};
