// TEMPORÁRIO — verifica se o runtime suporta EdgeRuntime.waitUntil (para
// processar em segundo plano após responder). Token-gated. REMOVER.
Deno.serve(async (req) => {
  const body = await req.json().catch(() => ({}));
  if (body.token !== 'diag-rt-2026') return Response.json({ error: 'forbidden' }, { status: 403 });
  // @ts-ignore — EdgeRuntime é global no runtime Supabase/Base44 quando existe.
  const er = typeof EdgeRuntime !== 'undefined' ? EdgeRuntime : null;
  return Response.json({
    tem_EdgeRuntime: er != null,
    // @ts-ignore
    tem_waitUntil: !!(er && typeof er.waitUntil === 'function'),
    deno: typeof Deno !== 'undefined',
  });
});
