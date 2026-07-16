import { createClient } from 'npm:@supabase/supabase-js@2';

// TEMPORÁRIO — testa se uma promise destacada (não-awaited) completa após a
// resposta ser enviada (indica runtime persistente). Token-gated. REMOVER.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const body = await req.json().catch(() => ({}));
  if (body.token !== 'diag-bg-2026') return Response.json({ error: 'forbidden' }, { status: 403 });
  const db = createClient(url!, key!, { auth: { autoRefreshToken: false, persistSession: false } });

  if (body.action === 'check') {
    const { count } = await db.from('auditoria').select('id', { count: 'exact', head: true }).eq('entidade', '_diag_bg');
    return Response.json({ marcadores: count ?? 0 });
  }

  // start: dispara trabalho de fundo SEM await; responde na hora.
  (async () => {
    try { await sleep(4000); await db.from('auditoria').insert({ entidade: '_diag_bg', acao: 'bg_done', valor_novo: { t: 'ok' } }); } catch { /* noop */ }
  })();
  return Response.json({ started: true });
});
