import { createClient } from '@supabase/supabase-js';

// =====================================================================
// CONSIGTEC — Configuração do Supabase
// Substitua os valores abaixo pelas credenciais do seu projeto Supabase.
// Encontre em: Project Settings → API (no painel do Supabase)
// A anon key é pública por design — o acesso é controlado via RLS.
// =====================================================================

const SUPABASE_URL = 'https://SEU_PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'SUA_ANON_KEY_AQUI';

export const isSupabaseConfigured =
  SUPABASE_URL !== 'https://SEU_PROJETO.supabase.co' &&
  SUPABASE_ANON_KEY !== 'SUA_ANON_KEY_AQUI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});