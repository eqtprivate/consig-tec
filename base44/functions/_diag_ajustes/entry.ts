// TEMPORÁRIO — valida a aba "Ajustes da leitura": schema 0089, config por
// empresa, reprocessamento (extração+custo+log) na CCB real. REMOVER após validar.
import { createClient } from 'npm:@supabase/supabase-js@2';
const GATE = '6948613d993f35bb74bc9b2d19d36da74366';
const PRICES: Record<string, [number, number]> = {
  'claude-haiku-4-5': [1, 5], 'claude-sonnet-5': [3, 15], 'claude-opus-4-8': [5, 25],
};
const cost = (m: string, u: any) => { const p = PRICES[m]; if (!p || !u) return null; return Number(((u.input_tokens||0)/1e6*p[0]+(u.output_tokens||0)/1e6*p[1]).toFixed(6)); };
const soDig = (v: any) => (v ? String(v).replace(/\D/g, '') : '');
function bytesToB64(bytes: Uint8Array) { let s=''; const c=0x8000; for (let i=0;i<bytes.length;i+=c) s+=String.fromCharCode(...bytes.subarray(i,i+c)); return btoa(s); }
const TOOL = { name:'extrair_ccb', description:'Extrai campos de uma CCB. null quando não constar.', input_schema:{ type:'object', additionalProperties:false, properties:{ numero_ccb:{type:['string','null']}, cpf:{type:['string','null']}, nome_cliente:{type:['string','null']}, convenio:{type:['string','null']}, valor_principal:{type:['number','null']}, valor_total:{type:['number','null']}, taxa_mensal:{type:['number','null']}, prazo:{type:['integer','null']}, valor_parcela:{type:['number','null']}, data_emissao:{type:['string','null']}, primeiro_vencimento:{type:['string','null']}, confianca:{type:'number'} }, required:['numero_ccb','cpf','valor_principal','prazo','valor_parcela','confianca'] } };

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error:'POST only' }, { status:405 });
  const body = await req.json().catch(() => ({}));
  if (body.token !== GATE) return Response.json({ error:'forbidden' }, { status:403 });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth:{ persistSession:false } });
  const anthKey = Deno.env.get('ANTHROPIC_API_KEY');
  const out: Record<string, unknown> = {};

  // 1) Schema check
  const chk = async (fn: () => Promise<any>) => { try { const { error } = await fn(); return error ? `erro: ${error.message}` : 'ok'; } catch (e) { return `exc: ${(e as Error).message}`; } };
  out.schema = {
    config_ingestao_ccb: await chk(() => admin.from('config_ingestao_ccb').select('empresa_id').limit(1)),
    ingestao_tentativas: await chk(() => admin.from('ingestao_tentativas').select('id').limit(1)),
    modelo_usado_col: await chk(() => admin.from('ingestoes_documento').select('modelo_usado').limit(1)),
  };

  // 2) Acha a CCB do Marcos (mais recente)
  const { data: ing } = await admin.from('ingestoes_documento').select('id, empresa_id, storage_path, arquivo_nome, status').ilike('arquivo_nome', '%MARCOS%').order('created_at', { ascending:false }).limit(1).maybeSingle();
  if (!ing) { out.ingestao = 'não encontrada (%MARCOS%)'; return Response.json(out); }
  out.ingestao = { id: ing.id, status_antes: ing.status, arquivo: ing.arquivo_nome, empresa_id: ing.empresa_id };

  // 3) Config por empresa: garante Haiku (piloto) e lê de volta
  await admin.from('config_ingestao_ccb').upsert({ empresa_id: ing.empresa_id, modelo: 'claude-haiku-4-5', confianca_minima: 0.75, atualizado_em: new Date().toISOString() }, { onConflict: 'empresa_id' });
  const { data: cfg } = await admin.from('config_ingestao_ccb').select('modelo, confianca_minima').eq('empresa_id', ing.empresa_id).maybeSingle();
  out.config = cfg;
  const model = cfg?.modelo || 'claude-sonnet-5';

  // 4) Reprocessa de verdade (download PDF → Claude → update + log)
  if (!anthKey) { out.reprocesso = 'sem ANTHROPIC_API_KEY'; return Response.json(out); }
  if (ing.status === 'aprovado') { out.reprocesso = 'ingestão já aprovada — não reprocessa'; return Response.json(out); }
  const t0 = Date.now();
  try {
    const { data: blob, error: dlErr } = await admin.storage.from('ccb-docs').download(ing.storage_path);
    if (dlErr || !blob) throw new Error('PDF não encontrado no Storage.');
    const b64 = bytesToB64(new Uint8Array(await blob.arrayBuffer()));
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST', headers:{ 'x-api-key':anthKey, 'anthropic-version':'2023-06-01', 'content-type':'application/json' },
      body: JSON.stringify({ model, max_tokens:1024, tools:[TOOL], tool_choice:{type:'tool',name:'extrair_ccb'}, messages:[{ role:'user', content:[ {type:'document', source:{type:'base64', media_type:'application/pdf', data:b64}}, {type:'text', text:'Extraia os campos desta CCB usando extrair_ccb.'} ] }] }),
    });
    const j = await res.json().catch(() => ({}));
    const tu = (j.content||[]).find((b:any)=>b.type==='tool_use');
    if (!tu) throw new Error(`sem tool_use (http ${res.status}): ${JSON.stringify(j).slice(0,200)}`);
    const ext = tu.input;
    const dados = { numero_ccb: ext.numero_ccb||null, cpf: soDig(ext.cpf), nome_cliente: ext.nome_cliente||null, convenio: ext.convenio||null, valor_principal: ext.valor_principal??null, valor_total: ext.valor_total??null, taxa_mensal: ext.taxa_mensal??null, prazo: ext.prazo??null, valor_parcela: ext.valor_parcela??null, data_emissao: ext.data_emissao||null, primeiro_vencimento: ext.primeiro_vencimento||null };
    await admin.from('ingestoes_documento').update({ status:'aguardando_conferencia', acao_sugerida:'novo_registro', dados_extraidos:dados, confianca: ext.confianca??null, modelo_usado: model }).eq('id', ing.id);
    await admin.from('ingestao_tentativas').insert({ empresa_id: ing.empresa_id, ingestao_id: ing.id, arquivo_nome: ing.arquivo_nome, modelo: model, status:'ok', tokens_entrada: j.usage?.input_tokens??null, tokens_saida: j.usage?.output_tokens??null, custo_usd: cost(model, j.usage), duracao_ms: Date.now()-t0, confianca: ext.confianca??null, reprocessamento: true });
    out.reprocesso = { modelo: model, http: res.status, elapsed_ms: Date.now()-t0, usage: j.usage, custo_usd: cost(model, j.usage), extraido: dados };
  } catch (e) { out.reprocesso = { erro: (e as Error).message, elapsed_ms: Date.now()-t0 }; }

  // 5) Lê o log de volta
  const { data: log } = await admin.from('ingestao_tentativas').select('created_at, modelo, status, tokens_entrada, tokens_saida, custo_usd, duracao_ms, confianca, reprocessamento').eq('empresa_id', ing.empresa_id).order('created_at', { ascending:false }).limit(5);
  out.log_recente = log;
  return Response.json(out);
});
