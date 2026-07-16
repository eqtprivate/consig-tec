import { createClient } from 'npm:@supabase/supabase-js@2';

// TEMPORÁRIO — testa comportamento de background. Token-gated. REMOVER.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const body = await req.json().catch(() => ({}));
  if (body.token !== 'diag-bg-2026') return Response.json({ error: 'forbidden' }, { status: 403 });
  const db = createClient(url!, key!, { auth: { autoRefreshToken: false, persistSession: false } });

  if (body.action === 'check') {
    const { data } = await db.from('auditoria').select('acao').eq('entidade', '_diag_bg');
    const counts: Record<string, number> = {};
    (data || []).forEach((r: any) => { counts[r.acao] = (counts[r.acao] || 0) + 1; });
    return Response.json({ counts });
  }

  if (body.action === 'start_await') {
    // Trabalho AWAITED no handler. Se o cliente desconectar antes dos 4s, isto
    // ainda deve completar se o runtime não aborta no disconnect.
    await sleep(4000);
    await db.from('auditoria').insert({ entidade: '_diag_bg', acao: 'bg_await', valor_novo: { t: 'ok' } });
    return Response.json({ done: true });
  }

  // detached (já testado: não completa).
  (async () => { try { await sleep(4000); await db.from('auditoria').insert({ entidade: '_diag_bg', acao: 'bg_detached' }); } catch { /* noop */ } })();
  return Response.json({ started: true });
});
