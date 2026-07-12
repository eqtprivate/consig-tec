import { supabase } from '@/lib/supabaseClient';

// Visão executiva consolidada da esteira (grupo) — função dashboard_executivo.
export const dashboardApi = {
  async executivo() {
    const { data, error } = await supabase.rpc('dashboard_executivo');
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  },
};
