import { createClient } from 'npm:@supabase/supabase-js@2';

// TEMPORÁRIO — valida 0096/0097. Token-gated. REMOVER.
Deno.serve(async (req) => {
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const body = await req.json().catch(() => ({}));
    if (body.token !== 'diag-logs2-2026') return Response.json({ error: 'forbidden' }, { status: 403 });
    const db = createClient(url!, key!, { auth: { autoRefreshToken: false, persistSession: false } });

    // 0097 aplicado? coluna detalhe presente.
    const { error: eDet } = await db.from('logs_acesso').select('detalhe').limit(0);
    const tem_detalhe = !eDet;

    // Últimas linhas da trilha (service role bypassa a RLS de leitura).
    const { data: ultimos } = await db.from('logs_acesso')
      .select('acao, entidade, registro_id, created_at')
      .order('created_at', { ascending: false }).limit(8);

    // Contagem por ação relevante.
    const { count: nDoc } = await db.from('logs_acesso').select('id', { count: 'exact', head: true }).eq('acao', 'leitura_documento_admin');
    const { count: nImp } = await db.from('logs_acesso').select('id', { count: 'exact', head: true }).eq('acao', 'impersonacao_inicio');

    return Response.json({
      tem_coluna_detalhe: tem_detalhe,
      leitura_documento_admin: nDoc ?? 0,
      impersonacao_inicio: nImp ?? 0,
      ultimos: (ultimos || []).map((r: any) => `${r.created_at?.slice(0, 19)} · ${r.acao} · ${r.entidade || ''}`),
    });
  } catch (e) {
    return Response.json({ error: 'exception', detail: (e as Error).message }, { status: 200 });
  }
});
