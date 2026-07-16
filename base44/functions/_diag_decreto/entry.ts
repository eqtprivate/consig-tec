import { createClient } from 'npm:@supabase/supabase-js@2';

// TEMPORÁRIO — diagnóstico do schema da ingestão de decretos (migração 0094).
// Token-gated. Somente leitura via service role. REMOVER após validar.
Deno.serve(async (req) => {
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const body = await req.json().catch(() => ({}));
    if (body.token !== 'diag-decreto-2026') return Response.json({ error: 'forbidden' }, { status: 403 });
    if (!url || !key) return Response.json({ error: 'sem service role', has_url: !!url, has_key: !!key }, { status: 200 });
    const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

    const wanted = ['decreto_numero','decreto_data','lei_base','margem_total_pct','margem_cartao_pct','limite_adiantamento_pct','recomposicao_margem_horas','reposicao_erario','tipos_consignacao_permitidos','consignatarias_habilitadas','decreto_ingestao_id','decreto_dados','regras_origem'];
    const presentes: string[] = [];
    for (const c of wanted) {
      const { error: e } = await db.from('convenios').select(c).limit(0);
      if (!e) presentes.push(c);
    }
    const { error: eConv } = await db.from('ingestoes_documento').select('convenio_id').limit(0);
    const { count } = await db.from('ingestoes_documento').select('id', { count: 'exact', head: true }).eq('tipo_documento', 'decreto');
    const { error: eRpc } = await db.rpc('aplicar_regras_decreto', { p_ingestao: '00000000-0000-0000-0000-000000000000', p_convenio: null, p_dados: {}, p_justificativa: null });
    const rpcExiste = !(eRpc && /PGRST202|could not find|not exist|schema cache/i.test(eRpc.message || ''));

    return Response.json({
      convenios_cols_presentes: presentes,
      convenios_cols_total: `${presentes.length}/${wanted.length}`,
      ing_convenio_id: eConv ? 0 : 1,
      rpc_aplicar_regras_decreto: rpcExiste ? 1 : 0,
      rpc_msg: eRpc?.message || null,
      decretos_ingeridos: count ?? 0,
    });
  } catch (e) {
    return Response.json({ error: 'exception', detail: (e as Error).message, stack: (e as Error).stack?.slice(0, 400) }, { status: 200 });
  }
});
