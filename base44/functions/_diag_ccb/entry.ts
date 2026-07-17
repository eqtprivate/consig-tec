import { createClient } from 'npm:@supabase/supabase-js@2';

// DIAGNÓSTICO TEMPORÁRIO (remover). Token-gated, read-only, service role.
// Retorna as últimas ingestões CCB e as últimas tentativas de leitura, p/
// entender por que a CCB fica presa em 'extraindo'.
const TOK = 'diag-ccb-7Kq2';

Deno.serve(async (req) => {
  const u = new URL(req.url);
  if (u.searchParams.get('t') !== TOK) return Response.json({ error: 'nope' }, { status: 403 });
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const admin = createClient(url!, key!, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: ings } = await admin.from('ingestoes_documento')
    .select('id, tipo_documento, status, observacao, arquivo_nome, storage_path, created_at')
    .eq('tipo_documento', 'ccb').order('created_at', { ascending: false }).limit(6);

  let tent = null, tentErr = null;
  try {
    const r = await admin.from('ingestao_tentativas')
      .select('ingestao_id, status, erro, reprocessamento, modelo, duracao_ms, created_at')
      .order('created_at', { ascending: false }).limit(8);
    tent = r.data; tentErr = r.error?.message || null;
  } catch (e) { tentErr = String(e); }

  return Response.json({ ings, tent, tentErr });
});
