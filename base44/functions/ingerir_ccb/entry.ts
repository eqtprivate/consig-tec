import { createClient } from 'npm:@supabase/supabase-js@2';

// Ingestão e leitura automática de CCB. Recebe o PDF (base64), garante
// idempotência por hash, sobe ao Storage privado, extrai os dados com a API do
// Claude (PDF nativo → OCR quando digitalizado), faz o matching e valida.
// NADA é gravado no negócio aqui — a saída é uma SUGESTÃO para conferência.
//
// O modelo e o limite de confiança vêm de config_ingestao_ccb (POR EMPRESA);
// fallback: secret CLAUDE_MODEL → claude-sonnet-5. Cada leitura registra uma
// linha em ingestao_tentativas (modelo, tokens, custo US$, duração, resultado).
// Reprocessamento: body.reprocessar_ingestao_id (+ opcional body.modelo) relê a
// mesma ingestão a partir do PDF já no Storage, com outro modelo sob demanda.
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, (opc) CLAUDE_MODEL.

const MODELOS_OK = ['claude-haiku-4-5', 'claude-sonnet-5', 'claude-opus-4-8'];
// [input, output] US$ por 1M tokens (tabela de referência; intro do Sonnet à parte).
const PRICES: Record<string, [number, number]> = {
  'claude-haiku-4-5': [1, 5],
  'claude-sonnet-5': [3, 15],
  'claude-sonnet-4-6': [3, 15],
  'claude-opus-4-8': [5, 25],
  'claude-opus-4-7': [5, 25],
};
function custoUsd(model: string, usage: any): number | null {
  const p = PRICES[model];
  if (!p || !usage) return null;
  const i = Number(usage.input_tokens || 0), o = Number(usage.output_tokens || 0);
  return Number(((i / 1e6) * p[0] + (o / 1e6) * p[1]).toFixed(6));
}

const numOrNull = (v: unknown) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[R$\s.]/g, (m) => (m === ',' ? '.' : '')).replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const soDig = (v: unknown) => (v ? String(v).replace(/\D/g, '') : '');
const S = (v: unknown) => { const s = v == null ? '' : String(v).trim(); return s === '' ? null : s; };

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/^data:.*;base64,/, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

// PMT (tabela Price): PV·i·(1+i)^n / ((1+i)^n − 1). i em fração ao mês.
function pmt(pv: number, taxaPct: number, n: number): number | null {
  if (!pv || !n || n <= 0) return null;
  const i = (taxaPct || 0) / 100;
  if (i === 0) return pv / n;
  const f = Math.pow(1 + i, n);
  return (pv * i * f) / (f - 1);
}
function cpfValido(cpf: string): boolean {
  const c = soDig(cpf);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (base: string, fator: number) => {
    let s = 0; for (const ch of base) s += Number(ch) * fator--;
    const r = (s * 10) % 11; return r === 10 ? 0 : r;
  };
  return dv(c.slice(0, 9), 10) === Number(c[9]) && dv(c.slice(0, 10), 11) === Number(c[10]);
}

const EXTRACT_TOOL = {
  name: 'extrair_ccb',
  description: 'Extrai os campos de uma Cédula de Crédito Bancário (CCB). Retorne null quando o campo não constar. Valores numéricos sem "R$" nem separador de milhar. Datas em ISO (AAAA-MM-DD). NUNCA infira, calcule ou complete valores ausentes.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      // Identificação
      numero_ccb: { type: ['string', 'null'] },
      data_emissao: { type: ['string', 'null'] },
      modalidade: { type: ['string', 'null'], description: 'Ex.: Cartão Consignado, Empréstimo Consignado' },
      praca_pagamento: { type: ['string', 'null'], description: 'Cidade/praça de pagamento ou emissão' },
      // Devedor (emitente)
      nome_cliente: { type: ['string', 'null'] },
      cpf: { type: ['string', 'null'], description: 'Somente dígitos' },
      rg: { type: ['string', 'null'] },
      orgao_expedidor: { type: ['string', 'null'], description: 'Órgão expedidor do RG e UF' },
      data_nascimento: { type: ['string', 'null'] },
      estado_civil: { type: ['string', 'null'] },
      nacionalidade: { type: ['string', 'null'] },
      naturalidade: { type: ['string', 'null'] },
      profissao: { type: ['string', 'null'] },
      email: { type: ['string', 'null'] },
      telefone: { type: ['string', 'null'] },
      // Endereço
      endereco: { type: ['string', 'null'], description: 'Logradouro' },
      numero_endereco: { type: ['string', 'null'] },
      complemento: { type: ['string', 'null'] },
      bairro: { type: ['string', 'null'] },
      cidade: { type: ['string', 'null'] },
      uf: { type: ['string', 'null'] },
      cep: { type: ['string', 'null'] },
      // Convênio / empregador
      convenio: { type: ['string', 'null'], description: 'Órgão/convênio consignante (ex.: Prefeitura)' },
      matricula: { type: ['string', 'null'] },
      orgao_empregador: { type: ['string', 'null'] },
      // Credor / correspondente
      credor_nome: { type: ['string', 'null'] },
      credor_cnpj: { type: ['string', 'null'] },
      correspondente_nome: { type: ['string', 'null'] },
      correspondente_cnpj: { type: ['string', 'null'] },
      // Condições financeiras
      valor_principal: { type: ['number', 'null'], description: 'Valor financiado / principal' },
      valor_liberado: { type: ['number', 'null'], description: 'Valor líquido creditado ao cliente' },
      valor_total: { type: ['number', 'null'], description: 'Valor total / a pagar' },
      taxa_mensal: { type: ['number', 'null'], description: 'Juros ao mês, em %' },
      taxa_anual: { type: ['number', 'null'], description: 'Juros ao ano, em %' },
      cet_mensal: { type: ['number', 'null'], description: 'Custo Efetivo Total ao mês, em %' },
      cet_anual: { type: ['number', 'null'], description: 'Custo Efetivo Total ao ano, em %' },
      iof: { type: ['number', 'null'], description: 'Valor do IOF' },
      tarifa_cadastro: { type: ['number', 'null'], description: 'TAC / tarifa de cadastro' },
      prazo: { type: ['integer', 'null'], description: 'Número de parcelas' },
      valor_parcela: { type: ['number', 'null'], description: 'Valor da parcela (PMT) conforme a CCB' },
      primeiro_vencimento: { type: ['string', 'null'] },
      ultimo_vencimento: { type: ['string', 'null'] },
      // Crédito ao cliente (dados bancários)
      banco_credito: { type: ['string', 'null'] },
      agencia_credito: { type: ['string', 'null'] },
      conta_credito: { type: ['string', 'null'] },
      tipo_conta: { type: ['string', 'null'] },
      confianca: { type: 'number', description: 'Confiança geral da extração, 0 a 1' },
    },
    required: ['numero_ccb', 'cpf', 'valor_principal', 'prazo', 'valor_parcela', 'confianca'],
  },
};

async function extrairComClaude(apiKey: string, model: string, base64: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model, max_tokens: 2048,
      tools: [EXTRACT_TOOL], tool_choice: { type: 'tool', name: 'extrair_ccb' },
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
          { type: 'text', text: 'Extraia os campos desta CCB usando a ferramenta extrair_ccb. Retorne null para o que não constar. Não invente nem calcule nada.' },
        ],
      }],
    }),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  const tu = (j.content || []).find((b: any) => b.type === 'tool_use');
  if (!tu) throw new Error('Extração sem tool_use na resposta.');
  return { input: tu.input as Record<string, unknown>, usage: j.usage };
}

// Config por empresa (defensivo: se a tabela ainda não existir, usa fallback).
async function lerConfig(admin: any, empresaId: string) {
  try {
    const { data } = await admin.from('config_ingestao_ccb')
      .select('modelo, confianca_minima').eq('empresa_id', empresaId).maybeSingle();
    return data || null;
  } catch { return null; }
}
// Log de tentativa (best-effort — nunca quebra a ingestão).
async function logTentativa(admin: any, row: Record<string, unknown>) {
  try { await admin.from('ingestao_tentativas').insert(row); } catch { /* noop */ }
}
// Grava o modelo usado (coluna pode não existir antes da migration 0089).
async function setModeloUsado(admin: any, id: string, model: string) {
  try { await admin.from('ingestoes_documento').update({ modelo_usado: model }).eq('id', id); } catch { /* noop */ }
}

// Matching + validações → { dados, divergencias, confianca, acao, propostaId }.
async function analisar(admin: any, empresaId: string, ext: Record<string, unknown>, confMin: number) {
  const numeroCcb = (ext.numero_ccb ? String(ext.numero_ccb).trim() : '') || null;
  const cpf = soDig(ext.cpf);
  const vPrinc = numOrNull(ext.valor_principal);
  const vTotal = numOrNull(ext.valor_total);
  const vTaxa = numOrNull(ext.taxa_mensal);
  const vPrazo = ext.prazo ? Math.round(Number(ext.prazo)) : null;
  const vPmt = numOrNull(ext.valor_parcela);
  const confianca = numOrNull(ext.confianca);

  let acao: 'duplicata' | 'completar_venda' | 'novo_registro' = 'novo_registro';
  let propostaId: string | null = null;

  if (numeroCcb) {
    const { data: ccbDup } = await admin.from('ccbs').select('id').eq('numero', numeroCcb).maybeSingle();
    if (ccbDup) acao = 'duplicata';
  }
  if (acao !== 'duplicata' && numeroCcb) {
    const { data: pn } = await admin.from('propostas').select('id').eq('numero', numeroCcb).eq('empresa_id', empresaId).maybeSingle();
    if (pn) { acao = 'completar_venda'; propostaId = pn.id; }
  }
  if (acao === 'novo_registro' && cpf && vPrinc != null) {
    const { data: cli } = await admin.from('clientes').select('id').eq('cpf', cpf).maybeSingle();
    if (cli) {
      const { data: props } = await admin.from('propostas')
        .select('id, valor_solicitado').eq('cliente_id', cli.id).eq('empresa_id', empresaId);
      const tol = Math.max(vPrinc * 0.02, 1);
      const hit = (props || []).find((p: any) => Math.abs(Number(p.valor_solicitado || 0) - vPrinc) <= tol);
      if (hit) { acao = 'completar_venda'; propostaId = hit.id; }
    }
  }

  const divergencias: Record<string, unknown>[] = [];
  const push = (campo: string, tipo: 'critica' | 'aviso', extraido: unknown, sistema: unknown, msg: string) =>
    divergencias.push({ campo, tipo, extraido, sistema, mensagem: msg });

  if (vPrinc != null && vPrazo && vPmt != null) {
    const calc = pmt(vPrinc, vTaxa || 0, vPrazo);
    if (calc != null) {
      const tol = Math.max(vPmt * 0.02, 0.5);
      if (Math.abs(calc - vPmt) > tol) push('valor_parcela', 'critica', vPmt, Number(calc.toFixed(2)), `PMT recalculado (${calc.toFixed(2)}) diverge do valor da CCB.`);
    }
  }
  if (propostaId && vPrinc != null) {
    const { data: p } = await admin.from('propostas').select('valor_solicitado').eq('id', propostaId).maybeSingle();
    const vs = Number(p?.valor_solicitado || 0);
    if (vs && Math.abs(vs - vPrinc) > Math.max(vs * 0.02, 1)) push('valor_principal', 'critica', vPrinc, vs, 'Valor da CCB diverge da proposta.');
  }
  if (cpf && !cpfValido(cpf)) push('cpf', 'critica', cpf, null, 'CPF inválido.');
  if (!cpf) push('cpf', 'aviso', null, null, 'CPF não encontrado no documento.');
  if (vTotal != null && vPmt != null && vPrazo) {
    const esperado = vPmt * vPrazo;
    if (Math.abs(esperado - vTotal) > Math.max(vTotal * 0.03, 1)) push('valor_total', 'aviso', vTotal, Number(esperado.toFixed(2)), 'Valor total ≠ parcela × prazo.');
  }
  // Trava por confiança (Item ajustes): abaixo do limite → revisão obrigatória.
  const revisaoForcada = confianca != null && confMin != null && confianca < confMin;
  if (revisaoForcada) push('confianca', 'critica', confianca, confMin, `Confiança ${Math.round((confianca as number) * 100)}% abaixo do limite (${Math.round(confMin * 100)}%). Revisão obrigatória.`);

  const dados = {
    // Identificação
    numero_ccb: numeroCcb, data_emissao: S(ext.data_emissao), modalidade: S(ext.modalidade), praca_pagamento: S(ext.praca_pagamento),
    // Devedor
    cpf, nome_cliente: S(ext.nome_cliente), rg: S(ext.rg), orgao_expedidor: S(ext.orgao_expedidor),
    data_nascimento: S(ext.data_nascimento), estado_civil: S(ext.estado_civil), nacionalidade: S(ext.nacionalidade),
    naturalidade: S(ext.naturalidade), profissao: S(ext.profissao), email: S(ext.email), telefone: S(ext.telefone),
    // Endereço
    endereco: S(ext.endereco), numero_endereco: S(ext.numero_endereco), complemento: S(ext.complemento),
    bairro: S(ext.bairro), cidade: S(ext.cidade), uf: S(ext.uf), cep: S(ext.cep),
    // Convênio / empregador
    convenio: S(ext.convenio), matricula: S(ext.matricula), orgao_empregador: S(ext.orgao_empregador),
    // Credor / correspondente
    credor_nome: S(ext.credor_nome), credor_cnpj: S(ext.credor_cnpj),
    correspondente_nome: S(ext.correspondente_nome), correspondente_cnpj: S(ext.correspondente_cnpj),
    // Financeiro
    valor_principal: vPrinc, valor_liberado: numOrNull(ext.valor_liberado), valor_total: vTotal,
    taxa_mensal: vTaxa, taxa_anual: numOrNull(ext.taxa_anual), cet_mensal: numOrNull(ext.cet_mensal), cet_anual: numOrNull(ext.cet_anual),
    iof: numOrNull(ext.iof), tarifa_cadastro: numOrNull(ext.tarifa_cadastro),
    prazo: vPrazo, valor_parcela: vPmt, primeiro_vencimento: S(ext.primeiro_vencimento), ultimo_vencimento: S(ext.ultimo_vencimento),
    // Bancário
    banco_credito: S(ext.banco_credito), agencia_credito: S(ext.agencia_credito), conta_credito: S(ext.conta_credito), tipo_conta: S(ext.tipo_conta),
  };

  return { dados, divergencias, confianca, acao, propostaId, revisaoForcada };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Método não permitido' }, { status: 405 });
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anthKey = Deno.env.get('ANTHROPIC_API_KEY');
  const modeloFallback = Deno.env.get('CLAUDE_MODEL') || 'claude-sonnet-5';
  if (!url || !serviceKey) return Response.json({ error: 'Configuração ausente (service role).' }, { status: 500 });

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // Autorização: admin/superadmin.
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!token) return Response.json({ error: 'Não autenticado' }, { status: 401 });
  const { data: caller } = await admin.auth.getUser(token);
  if (!caller?.user) return Response.json({ error: 'Sessão inválida' }, { status: 401 });
  const { data: perfil } = await admin.from('usuarios').select('role, empresa_id').eq('id', caller.user.id).single();
  if (!perfil || !['admin', 'superadmin'].includes(perfil.role)) return Response.json({ error: 'Sem permissão' }, { status: 403 });

  const body = await req.json().catch(() => ({}));

  // Modelo pedido (só superadmin/admin; validado contra a lista). Usado no
  // reprocessamento e como override manual.
  const modeloPedido = MODELOS_OK.includes(body.modelo) ? body.modelo : null;

  // ---------------------------------------------------------------
  // BRANCH A — Reprocessar uma ingestão existente com outro modelo.
  // ---------------------------------------------------------------
  if (body.reprocessar_ingestao_id) {
    const { data: ing } = await admin.from('ingestoes_documento')
      .select('id, empresa_id, storage_path, arquivo_nome, status').eq('id', body.reprocessar_ingestao_id).maybeSingle();
    if (!ing) return Response.json({ error: 'Ingestão não encontrada.' }, { status: 404 });
    if (perfil.role !== 'superadmin' && ing.empresa_id !== perfil.empresa_id) return Response.json({ error: 'Sem permissão nesta ingestão.' }, { status: 403 });
    if (ing.status === 'aprovado') return Response.json({ error: 'Ingestão já aprovada — não pode ser reprocessada.' }, { status: 409 });
    if (!anthKey) return Response.json({ error: 'ANTHROPIC_API_KEY não configurada.' }, { status: 200 });

    const cfg = await lerConfig(admin, ing.empresa_id);
    const model = modeloPedido || cfg?.modelo || modeloFallback;
    const confMin = cfg?.confianca_minima != null ? Number(cfg.confianca_minima) : 0.75;

    const t0 = Date.now();
    try {
      const { data: blob, error: dlErr } = await admin.storage.from('ccb-docs').download(ing.storage_path);
      if (dlErr || !blob) throw new Error('PDF original não encontrado no Storage.');
      const b64 = bytesToB64(new Uint8Array(await blob.arrayBuffer()));

      const { input: ext, usage } = await extrairComClaude(anthKey, model, b64);
      const a = await analisar(admin, ing.empresa_id, ext, confMin);
      await admin.from('ingestoes_documento').update({
        status: 'aguardando_conferencia', acao_sugerida: a.acao, proposta_id: a.propostaId,
        dados_extraidos: a.dados, divergencias: a.divergencias, confianca: a.confianca,
      }).eq('id', ing.id);
      await setModeloUsado(admin, ing.id, model);

      await logTentativa(admin, {
        empresa_id: ing.empresa_id, ingestao_id: ing.id, arquivo_nome: ing.arquivo_nome, modelo: model,
        status: 'ok', tokens_entrada: usage?.input_tokens ?? null, tokens_saida: usage?.output_tokens ?? null,
        custo_usd: custoUsd(model, usage), duracao_ms: Date.now() - t0, confianca: a.confianca,
        revisao_forcada: a.revisaoForcada, reprocessamento: true, criado_por: caller.user.id,
      });
      return Response.json({ id: ing.id, status: 'aguardando_conferencia', modelo_usado: model, acao_sugerida: a.acao, proposta_id: a.propostaId, dados_extraidos: a.dados, divergencias: a.divergencias, confianca: a.confianca });
    } catch (e) {
      await admin.from('ingestoes_documento').update({ status: 'erro', observacao: (e as Error).message }).eq('id', ing.id);
      await setModeloUsado(admin, ing.id, model);
      await logTentativa(admin, {
        empresa_id: ing.empresa_id, ingestao_id: ing.id, arquivo_nome: ing.arquivo_nome, modelo: model,
        status: 'erro', duracao_ms: Date.now() - t0, erro: (e as Error).message, reprocessamento: true, criado_por: caller.user.id,
      });
      return Response.json({ id: ing.id, status: 'erro', error: (e as Error).message }, { status: 200 });
    }
  }

  // ---------------------------------------------------------------
  // BRANCH B — Nova ingestão a partir do PDF enviado.
  // ---------------------------------------------------------------
  const base64: string = body.arquivo_base64 || '';
  const arquivoNome: string = body.arquivo_nome || 'ccb.pdf';
  if (!base64) return Response.json({ error: 'arquivo_base64 é obrigatório.' }, { status: 400 });
  const empresaId = (perfil.role === 'superadmin' && body.empresa_id) ? body.empresa_id : perfil.empresa_id;
  if (!empresaId) return Response.json({ error: 'Usuário sem empresa.' }, { status: 400 });

  let bytes: Uint8Array;
  try { bytes = b64ToBytes(base64); } catch { return Response.json({ error: 'base64 inválido.' }, { status: 400 }); }
  const hash = await sha256Hex(bytes);

  // Idempotência: mesmo arquivo (hash) por empresa → devolve a ingestão existente.
  const { data: existente } = await admin.from('ingestoes_documento')
    .select('id, status, ccb_id, acao_sugerida').eq('empresa_id', empresaId).eq('hash_sha256', hash).maybeSingle();
  if (existente) {
    await logTentativa(admin, { empresa_id: empresaId, ingestao_id: existente.id, arquivo_nome: arquivoNome, status: 'duplicado', criado_por: caller.user.id });
    return Response.json({ id: existente.id, duplicado: true, ...existente });
  }

  const cfg = await lerConfig(admin, empresaId);
  const model = modeloPedido || cfg?.modelo || modeloFallback;
  const confMin = cfg?.confianca_minima != null ? Number(cfg.confianca_minima) : 0.75;

  // Upload ao Storage privado.
  const storagePath = `${empresaId}/${hash}.pdf`;
  try {
    await admin.storage.from('ccb-docs').upload(storagePath, bytes, { contentType: 'application/pdf', upsert: true });
  } catch { /* segue mesmo se o upload falhar; o hash garante idempotência */ }

  // Cria a ingestão (extraindo).
  const { data: ing, error: insErr } = await admin.from('ingestoes_documento').insert({
    empresa_id: empresaId, tipo_documento: 'ccb', arquivo_nome: arquivoNome, storage_path: storagePath,
    hash_sha256: hash, status: 'extraindo', enviado_por: caller.user.id,
  }).select().single();
  if (insErr) return Response.json({ error: insErr.message }, { status: 400 });

  const t0 = Date.now();
  try {
    if (!anthKey) throw new Error('ANTHROPIC_API_KEY não configurada.');
    const { input: ext, usage } = await extrairComClaude(anthKey, model, base64.replace(/^data:.*;base64,/, ''));
    const a = await analisar(admin, empresaId, ext, confMin);

    await admin.from('ingestoes_documento').update({
      status: 'aguardando_conferencia', acao_sugerida: a.acao, proposta_id: a.propostaId,
      dados_extraidos: a.dados, divergencias: a.divergencias, confianca: a.confianca,
    }).eq('id', ing.id);
    await setModeloUsado(admin, ing.id, model);

    await logTentativa(admin, {
      empresa_id: empresaId, ingestao_id: ing.id, arquivo_nome: arquivoNome, modelo: model,
      status: 'ok', tokens_entrada: usage?.input_tokens ?? null, tokens_saida: usage?.output_tokens ?? null,
      custo_usd: custoUsd(model, usage), duracao_ms: Date.now() - t0, confianca: a.confianca,
      revisao_forcada: a.revisaoForcada, reprocessamento: false, criado_por: caller.user.id,
    });

    return Response.json({ id: ing.id, status: 'aguardando_conferencia', modelo_usado: model, acao_sugerida: a.acao, proposta_id: a.propostaId, dados_extraidos: a.dados, divergencias: a.divergencias, confianca: a.confianca });
  } catch (e) {
    await admin.from('ingestoes_documento').update({ status: 'erro', observacao: (e as Error).message }).eq('id', ing.id);
    await setModeloUsado(admin, ing.id, model);
    await logTentativa(admin, {
      empresa_id: empresaId, ingestao_id: ing.id, arquivo_nome: arquivoNome, modelo: model,
      status: 'erro', duracao_ms: Date.now() - t0, erro: (e as Error).message, reprocessamento: false, criado_por: caller.user.id,
    });
    return Response.json({ id: ing.id, status: 'erro', error: (e as Error).message }, { status: 200 });
  }
});
