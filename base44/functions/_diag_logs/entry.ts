import { createClient } from 'npm:@supabase/supabase-js@2';

// TEMPORÁRIO — inspeciona colunas reais de logs_acesso/auditoria. Token-gated. REMOVER.
Deno.serve(async (req) => {
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const body = await req.json().catch(() => ({}));
    if (body.token !== 'diag-logs-2026') return Response.json({ error: 'forbidden' }, { status: 403 });
    const db = createClient(url!, key!, { auth: { autoRefreshToken: false, persistSession: false } });
    const colsOf = async (t: string) => {
      const cand = ['id','ator_id','ator_email','evento','empresa_alvo','detalhe','usuario_id','acao','entidade','registro_id','valor_antigo','valor_novo','empresa_id','created_at','ip','user_agent','ativo'];
      const found: string[] = [];
      for (const c of cand) { const { error } = await db.from(t).select(c).limit(0); if (!error) found.push(c); }
      return found;
    };
    return Response.json({ logs_acesso: await colsOf('logs_acesso'), auditoria: await colsOf('auditoria') });
  } catch (e) {
    return Response.json({ error: 'exception', detail: (e as Error).message }, { status: 200 });
  }
});
