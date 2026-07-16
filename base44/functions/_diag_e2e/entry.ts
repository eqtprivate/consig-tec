import { createClient } from 'npm:@supabase/supabase-js@2';

// TEMPORÁRIO — inventário de dados para o teste E2E. Token-gated, service role. REMOVER.
Deno.serve(async (req) => {
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const body = await req.json().catch(() => ({}));
    if (body.token !== 'diag-e2e-2026') return Response.json({ error: 'forbidden' }, { status: 403 });
    const db = createClient(url!, key!, { auth: { autoRefreshToken: false, persistSession: false } });

    const { count: nConv } = await db.from('convenios').select('id', { count: 'exact', head: true });
    const { data: convs } = await db.from('convenios')
      .select('nome, orgao, decreto_numero, teto_parcelas, margem_total_pct').order('nome').limit(12);

    const st = async (tipo: string, status?: string) => {
      let q = db.from('ingestoes_documento').select('id', { count: 'exact', head: true }).eq('tipo_documento', tipo);
      if (status) q = q.eq('status', status);
      const { count } = await q; return count ?? 0;
    };
    const { count: nCcbs } = await db.from('ccbs').select('id', { count: 'exact', head: true });

    return Response.json({
      convenios_total: nConv ?? 0,
      convenios_amostra: (convs || []).map((c: any) => `${c.nome}${c.orgao ? ' ('+c.orgao+')' : ''} | decreto:${c.decreto_numero || '—'} teto:${c.teto_parcelas ?? '—'} margem:${c.margem_total_pct ?? '—'}`),
      ccb_ingest_total: await st('ccb'),
      ccb_aguardando_conferencia: await st('ccb', 'aguardando_conferencia'),
      ccb_aprovado: await st('ccb', 'aprovado'),
      decreto_ingest_total: await st('decreto'),
      decreto_aguardando_conferencia: await st('decreto', 'aguardando_conferencia'),
      ccbs_geradas: nCcbs ?? 0,
    });
  } catch (e) {
    return Response.json({ error: 'exception', detail: (e as Error).message }, { status: 200 });
  }
});
