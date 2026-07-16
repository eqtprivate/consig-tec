// TEMPORÁRIO — valida 0092 (cota) + 0093 (gestão). REMOVER após validar.
import { createClient } from 'npm:@supabase/supabase-js@2';
const GATE = '6948613d993f35bb74bc9b2d19d36da74366';
Deno.serve(async (req) => {
  const body = await req.json().catch(() => ({}));
  if (body.token !== GATE) return Response.json({ error: 'forbidden' }, { status: 403 });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const chk = async (fn: () => Promise<any>) => { try { const { error } = await fn(); return error ? `ERRO: ${error.message}` : 'ok'; } catch (e) { return `EXC: ${(e as Error).message}`; } };
  const rpc = async (name: string, args: any) => { try { const { data, error } = await admin.rpc(name, args); return error ? `ERRO: ${error.message}` : data; } catch (e) { return `EXC: ${(e as Error).message}`; } };
  const out: Record<string, unknown> = {};

  out.colunas = {
    planos_limites: await chk(() => admin.from('planos').select('limite_leituras_ccb_mes, limite_armazenamento_mb, limite_documentos').limit(1)),
    ingest_tamanho: await chk(() => admin.from('ingestoes_documento').select('tamanho_bytes').limit(1)),
  };
  out.funcoes = {
    uso_ingestao: await rpc('uso_ingestao_empresa', { p_empresa: null }),          // service role → {bloqueia:false}
    plano_uso: await rpc('plano_uso_empresa', {}),                                  // service role → null
    excluir_tentativa: await rpc('excluir_tentativa_ingestao', { p_id: null }),     // void → existe
    limpar_tentativas: await rpc('limpar_tentativas_ingestao', { p_empresa: null }),// erro auth → existe
    excluir_ingestao: await rpc('excluir_ingestao', { p_id: null }),               // erro 'não encontrada' → existe
    backfill: await rpc('backfill_tamanho_ccb', {}),                                // erro superadmin → existe
  };

  // Backfill direto (service role) do tamanho dos PDFs já enviados.
  try {
    const { data: objs } = await admin.schema('storage').from('objects')
      .select('name, metadata').eq('bucket_id', 'ccb-docs').limit(1000);
    let atualizados = 0;
    for (const o of objs || []) {
      const size = Number(o.metadata?.size || 0);
      if (!size) continue;
      const { error, count } = await admin.from('ingestoes_documento')
        .update({ tamanho_bytes: size }, { count: 'exact' }).eq('storage_path', o.name).is('tamanho_bytes', null);
      if (!error && count) atualizados += count;
    }
    out.backfill_direto = { objetos: (objs || []).length, ingestoes_atualizadas: atualizados };
  } catch (e) { out.backfill_direto = `EXC: ${(e as Error).message}`; }

  // Uso REAL da empresa da ingestão mais recente (replicando a lógica do RPC).
  const { data: ult } = await admin.from('ingestoes_documento').select('empresa_id').order('created_at', { ascending: false }).limit(1).maybeSingle();
  const emp = ult?.empresa_id;
  if (emp) {
    const mes = new Date(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1).toISOString();
    const c = async (q: any) => { const { count } = await q; return count || 0; };
    const leituras = await c(admin.from('ingestoes_documento').select('id', { count: 'exact', head: true }).eq('empresa_id', emp).gte('created_at', mes));
    const docs = await c(admin.from('ingestoes_documento').select('id', { count: 'exact', head: true }).eq('empresa_id', emp).neq('status', 'rejeitado'));
    const { data: sizes } = await admin.from('ingestoes_documento').select('tamanho_bytes').eq('empresa_id', emp);
    const mb = Math.round((sizes || []).reduce((s: number, r: any) => s + Number(r.tamanho_bytes || 0), 0) / 1048576 * 10) / 10;
    const { data: emprow } = await admin.from('empresas').select('nome, plano:planos(nome, limite_leituras_ccb_mes, limite_documentos, limite_armazenamento_mb)').eq('id', emp).maybeSingle();
    out.uso_real = { empresa: emprow?.nome, plano: emprow?.plano, leituras_mes: leituras, documentos: docs, armazenamento_mb: mb };
  }
  return Response.json(out);
});
