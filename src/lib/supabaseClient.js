import { createClient } from '@supabase/supabase-js';

// =====================================================================
// CONSIGTEC — Cliente Supabase (frontend)
// A URL e anon key são obtidas do backend function "supabaseConfig".
// A anon key é pública por design — o acesso é controlado via RLS.
// A service_role key permanece apenas no backend.
// =====================================================================

let _supabase = null;
let _initPromise = null;

export async function initSupabase() {
  if (_supabase) return _supabase;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const res = await fetch('/api/functions/supabaseConfig');
    if (!res.ok) throw new Error('Falha ao obter configuração do Supabase');
    const config = await res.json();
    _supabase = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    return _supabase;
  })();

  return _initPromise;
}

export function getSupabase() {
  return _supabase;
}

// Proxy que inicializa sob demanda — permite importar e usar como antes
export const supabase = new Proxy({}, {
  get(_target, prop) {
    if (!_supabase) {
      throw new Error(
        'Supabase ainda não inicializado. Chame await initSupabase() antes de usar.'
      );
    }
    return _supabase[prop];
  },
});

export const isSupabaseConfigured = true;