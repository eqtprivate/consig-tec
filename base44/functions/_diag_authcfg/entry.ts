import { createClient } from 'npm:@supabase/supabase-js@2';

// TEMPORÁRIO — lê o estado de signup do Auth + procura trigger/usuário órfão.
// Token-gated. REMOVER após validar.
Deno.serve(async (req) => {
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const body = await req.json().catch(() => ({}));
    if (body.token !== 'diag-authcfg-2026') return Response.json({ error: 'forbidden' }, { status: 403 });

    // Estado de signup (GoTrue settings — público via anon).
    let settings: any = null, settingsErr: string | null = null;
    try {
      const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anon! } });
      settings = await r.json();
    } catch (e) { settingsErr = (e as Error).message; }

    // Defesa em profundidade: quantos auth.users existem × quantos têm perfil em usuarios.
    const db = createClient(url!, key!, { auth: { autoRefreshToken: false, persistSession: false } });
    const { count: nUsuarios } = await db.from('usuarios').select('id', { count: 'exact', head: true });
    // usuários sem empresa e sem role (não teriam acesso a nada via RLS).
    const { count: nSemEmpresa } = await db.from('usuarios').select('id', { count: 'exact', head: true }).is('empresa_id', null);

    return Response.json({
      disable_signup: settings?.disable_signup ?? null,
      mailer_autoconfirm: settings?.mailer_autoconfirm ?? null,
      external_email: settings?.external?.email ?? null,
      settings_erro: settingsErr,
      usuarios_total: nUsuarios ?? null,
      usuarios_sem_empresa: nSemEmpresa ?? null,
    });
  } catch (e) {
    return Response.json({ error: 'exception', detail: (e as Error).message }, { status: 200 });
  }
});
