import { createClient } from 'npm:@supabase/supabase-js@2';

// TEMPORÁRIO — diagnóstico do schema da ingestão de decretos (migração 0094).
// Token-gated (body.token). Somente leitura de information_schema/pg_proc via
// service role. REMOVER após validar.
Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const body = await req.json().catch(() => ({}));
  if (body.token !== 'diag-decreto-2026') return Response.json({ error: 'forbidden' }, { status: 403 });
  if (!url || !key) return Response.json({ error: 'sem service role' }, { status: 500 });
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const sql = `select json_build_object(
    'convenios_cols', (select coalesce(json_agg(column_name order by column_name),'[]') from information_schema.columns
        where table_name='convenios' and column_name = any(array['decreto_numero','decreto_data','lei_base','margem_total_pct','margem_cartao_pct','limite_adiantamento_pct','recomposicao_margem_horas','reposicao_erario','tipos_consignacao_permitidos','consignatarias_habilitadas','decreto_ingestao_id','decreto_dados','regras_origem'])),
    'ing_convenio_id', (select count(*) from information_schema.columns where table_name='ingestoes_documento' and column_name='convenio_id'),
    'rpc_aplicar_regras_decreto', (select count(*) from pg_proc where proname='aplicar_regras_decreto'),
    'decretos_ingeridos', (select count(*) from ingestoes_documento where tipo_documento='decreto')
  ) as r`;

  // Executa via RPC utilitária se existir; senão, usa uma função anônima.
  const { data, error } = await db.rpc('_diag_exec_sql', { p_sql: sql }).catch(() => ({ data: null, error: { message: 'no-rpc' } }));
  if (!error && data) return Response.json({ via: 'rpc', data });

  // Fallback: consultas diretas via PostgREST (schema public exposto).
  const out: Record<string, unknown> = {};
  const wanted = ['decreto_numero','decreto_data','lei_base','margem_total_pct','margem_cartao_pct','limite_adiantamento_pct','recomposicao_margem_horas','reposicao_erario','tipos_consignacao_permitidos','consignatarias_habilitadas','decreto_ingestao_id','decreto_dados','regras_origem'];
  // Testa cada coluna do convenios com um select limit 0 (erro => não existe).
  const presentes: string[] = [];
  for (const c of wanted) {
    const { error: e } = await db.from('convenios').select(c).limit(0);
    if (!e) presentes.push(c);
  }
  out.convenios_cols = presentes;
  const { error: eConv } = await db.from('ingestoes_documento').select('convenio_id').limit(0);
  out.ing_convenio_id = eConv ? 0 : 1;
  const { count } = await db.from('ingestoes_documento').select('id', { count: 'exact', head: true }).eq('tipo_documento', 'decreto');
  out.decretos_ingeridos = count ?? 0;
  // Testa a RPC chamando com args inválidos: se existir, dá erro de permissão/nulo; se não existir, erro PGRST202 (function not found).
  const { error: eRpc } = await db.rpc('aplicar_regras_decreto', { p_ingestao: '00000000-0000-0000-0000-000000000000', p_convenio: null, p_dados: {}, p_justificativa: null });
  out.rpc_aplicar_regras_decreto = (eRpc && /PGRST202|does not exist|not find|schema cache/i.test(eRpc.message || '')) ? 0 : 1;
  out.rpc_err = eRpc?.message || null;
  return Response.json({ via: 'fallback', data: out });
});
