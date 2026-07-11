import { supabase } from '@/lib/supabaseClient';

// Overlay comercial do convênio (propriedade do CONSIGTEC): comissão/spread
// (pool) + rateio por canal/franquia/líder/corban/operador + habilitação.
export const overlayApi = {
  async getByConvenio(convenioId) {
    const { data, error } = await supabase
      .from('overlay_comercial_convenio')
      .select('*')
      .eq('convenio_id', convenioId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  async upsert(convenioId, values) {
    const { data, error } = await supabase
      .from('overlay_comercial_convenio')
      .upsert({ convenio_id: convenioId, ...values }, { onConflict: 'convenio_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
