import { supabase } from '@/lib/supabaseClient';

// Dispara o full sync da API PixConsig (função backend syncPixconsig).
export const pixconsigApi = {
  async sync(opts = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/functions/syncPixconsig', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify(opts),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Falha ao sincronizar');
    return data; // { configurado, total, ok, ignorados, paginas, erros }
  },
};
