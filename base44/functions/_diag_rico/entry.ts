// TEMPORÁRIO — valida a extração RICA na CCB real. REMOVER após medir.
import { createClient } from 'npm:@supabase/supabase-js@2';
const GATE = '6948613d993f35bb74bc9b2d19d36da74366';
const P = (d:string)=>({type:['string','null'],description:d});
const N = (d:string)=>({type:['number','null'],description:d});
const TOOL = { name:'extrair_ccb', description:'Extrai campos de uma CCB. null quando não constar. NUNCA infira.', input_schema:{ type:'object', additionalProperties:false, properties:{
  numero_ccb:P(''), data_emissao:P(''), modalidade:P('ex.: Cartão Consignado'), praca_pagamento:P(''),
  nome_cliente:P(''), cpf:P('só dígitos'), rg:P(''), orgao_expedidor:P('órgão exp. e UF'), data_nascimento:P(''), estado_civil:P(''), nacionalidade:P(''), naturalidade:P(''), profissao:P(''), email:P(''), telefone:P(''),
  endereco:P('logradouro'), numero_endereco:P(''), complemento:P(''), bairro:P(''), cidade:P(''), uf:P(''), cep:P(''),
  convenio:P('órgão/convênio consignante'), matricula:P(''), orgao_empregador:P(''),
  credor_nome:P(''), credor_cnpj:P(''), correspondente_nome:P(''), correspondente_cnpj:P(''),
  valor_principal:N('principal'), valor_liberado:N('líquido creditado'), valor_total:N('total a pagar'), taxa_mensal:N('% a.m.'), taxa_anual:N('% a.a.'), cet_mensal:N('CET % a.m.'), cet_anual:N('CET % a.a.'), iof:N('valor IOF'), tarifa_cadastro:N('TAC'), prazo:{type:['integer','null']}, valor_parcela:N('PMT'), primeiro_vencimento:P(''), ultimo_vencimento:P(''),
  banco_credito:P(''), agencia_credito:P(''), conta_credito:P(''), tipo_conta:P(''),
  confianca:{type:'number'} }, required:['numero_ccb','cpf','valor_principal','prazo','valor_parcela','confianca'] } };
function b64(b:Uint8Array){let s='';const c=0x8000;for(let i=0;i<b.length;i+=c)s+=String.fromCharCode(...b.subarray(i,i+c));return btoa(s);}
Deno.serve(async (req)=>{
  const body=await req.json().catch(()=>({})); if(body.token!==GATE) return Response.json({error:'forbidden'},{status:403});
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const key=Deno.env.get('ANTHROPIC_API_KEY'); const model=body.model||'claude-haiku-4-5';
  const {data:ing}=await admin.from('ingestoes_documento').select('storage_path,arquivo_nome').ilike('arquivo_nome','%MARCOS%').order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(!ing) return Response.json({error:'ingestão não encontrada'});
  const {data:blob,error}=await admin.storage.from('ccb-docs').download(ing.storage_path);
  if(error||!blob) return Response.json({error:'PDF não encontrado'});
  const t0=Date.now();
  const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':key!,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model,max_tokens:2048,tools:[TOOL],tool_choice:{type:'tool',name:'extrair_ccb'},messages:[{role:'user',content:[{type:'document',source:{type:'base64',media_type:'application/pdf',data:b64(new Uint8Array(await blob.arrayBuffer()))}},{type:'text',text:'Extraia os campos desta CCB usando extrair_ccb.'}]}]})});
  const j=await res.json().catch(()=>({})); const tu=(j.content||[]).find((b:any)=>b.type==='tool_use');
  const ext=tu?tu.input:{}; const total=Object.keys(ext).length; const preenchidos=Object.entries(ext).filter(([,v])=>v!==null&&v!=='').length;
  return Response.json({model,http:res.status,elapsed_ms:Date.now()-t0,usage:j.usage,campos_preenchidos:preenchidos,campos_total:total,extraido:ext});
});
