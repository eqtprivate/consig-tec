import { createClient } from 'npm:@supabase/supabase-js@2';

// TEMPORÁRIO — valida a migração 0095 (documentos_admin). Token-gated, service role.
// REMOVER após validar.
Deno.serve(async (req) => {
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const body = await req.json().catch(() => ({}));
    if (body.token !== 'diag-docadmin-2026') return Response.json({ error: 'forbidden' }, { status: 403 });
    if (!url || !key) return Response.json({ error: 'sem service role' }, { status: 200 });
    const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

    // Tabela + colunas (via select limit 0).
    const wanted = ['id', 'titulo', 'categoria', 'conteudo', 'confidencial', 'ordem', 'created_by', 'updated_by'];
    const cols: string[] = [];
    for (const c of wanted) { const { error } = await db.from('documentos_admin').select(c).limit(0); if (!error) cols.push(c); }

    // Seed: títulos e categorias (service role bypassa RLS).
    const { data: docs } = await db.from('documentos_admin').select('titulo, categoria, confidencial').order('ordem');

    // Funções existem? Chama get_documento_admin com id nulo: como service role tem
    // auth.uid()=null, auth_is_superadmin() é false → deve RAISE 'Acesso negado'
    // (isso PROVA que a trava nega quem não é superadmin).
    const { error: eGet } = await db.rpc('get_documento_admin', { p_id: '00000000-0000-0000-0000-000000000000' });
    const getNegaNaoSuper = /acesso negado/i.test(eGet?.message || '');
    const getExiste = getNegaNaoSuper || !/PGRST202|could not find|schema cache/i.test(eGet?.message || '');

    const { error: eSalvar } = await db.rpc('salvar_documento_admin', { p_id: null, p_titulo: 'x', p_categoria: 'x', p_conteudo: 'x', p_confidencial: true });
    const salvarNegaNaoSuper = /acesso negado/i.test(eSalvar?.message || '');

    return Response.json({
      tabela_colunas: `${cols.length}/${wanted.length}`,
      colunas: cols,
      seed: (docs || []).map((d: any) => `${d.categoria}: ${d.titulo}${d.confidencial ? ' [CONF]' : ''}`),
      get_documento_admin_existe: getExiste,
      get_nega_nao_superadmin: getNegaNaoSuper,
      salvar_nega_nao_superadmin: salvarNegaNaoSuper,
      get_msg: eGet?.message || null,
    });
  } catch (e) {
    return Response.json({ error: 'exception', detail: (e as Error).message }, { status: 200 });
  }
});
