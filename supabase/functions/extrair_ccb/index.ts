// Edge Function (Supabase) — EXTRAÇÃO DE CCB em segundo plano.
//
// Por que existe: as functions do Base44 têm teto de ~30s por requisição, e a
// leitura de uma CCB grande (PDF de várias páginas, ~45 campos) estoura esse
// limite — a ingestão ficava presa em 'extraindo'. Aqui a extração roda no
// runtime do Supabase (limite bem maior) e usa EdgeRuntime.waitUntil para
// concluir DEPOIS de responder — background real, mesmo se o cliente sair.
//
// Fluxo: o Base44 (ingerir_ccb) sobe o PDF ao Storage, cria a ingestão como
// 'extraindo' e retorna na hora. O cliente chama esta função com o ingestao_id;
// ela baixa o PDF do Storage, chama o Claude, valida/analisa e grava o status.
//
// Deploy (uma vez):
//   supabase functions deploy extrair_ccb --project-ref blnslbrflspiflrwsuzh
//   supabase secrets set ANTHROPIC_API_KEY=... --project-ref blnslbrflspiflrwsuzh
//   (opcional) supabase secrets set CLAUDE_MODEL=claude-sonnet-5 --project-ref ...
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY são injetados automaticamente.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// deno-lint-ignore no-explicit-any
declare const EdgeRuntime: any;

const MODELOS_OK = ['claude-haiku-4-5', 'claude-sonnet-5', 'claude-opus-4-8'];
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
const soDigitos = (v: unknown) => (String(v ?? '').replace(/\D/g, '') || null);
const S = (v: unknown) => { const s = v == null ? '' : String(v).trim(); return s === '' ? null : s; };

function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

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
  description: 'Extrai os campos de uma Cédula de Crédito Bancário (CCB). Para campos ausentes use null — NUNCA "N/A", "não informado" nem texto equivalente. Valores numéricos sem "R$" nem separador de milhar. Datas em ISO (AAAA-MM-DD). NUNCA infira, calcule ou complete valores ausentes.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      numero_ccb: { type: ['string', 'null'] },
      data_emissao: { type: ['string', 'null'] },
      modalidade: { type: ['string', 'null'], description: 'Ex.: Cartão Consignado, Empréstimo Consignado' },
      praca_pagamento: { type: ['string', 'null'], description: 'Cidade/praça de pagamento ou emissão' },
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
      endereco: { type: ['string', 'null'], description: 'Logradouro' },
      numero_endereco: { type: ['string', 'null'] },
      complemento: { type: ['string', 'null'] },
      bairro: { type: ['string', 'null'] },
      cidade: { type: ['string', 'null'] },
      uf: { type: ['string', 'null'] },
      cep: { type: ['string', 'null'] },
      convenio: { type: ['string', 'null'], description: 'Órgão/convênio consignante (ex.: Prefeitura)' },
      matricula: { type: ['string', 'null'] },
      orgao_empregador: { type: ['string', 'null'] },
      credor_nome: { type: ['string', 'null'] },
      credor_cnpj: { type: ['string', 'null'] },
      correspondente_nome: { type: ['string', 'null'] },
      correspondente_cnpj: { type: ['string', 'null'] },
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
          { type: 'text', text: 'Extraia os campos desta CCB usando a ferramenta extrair_ccb. Para o que não constar, retorne null (nunca "N/A" ou texto). Não invente nem calcule nada.' },
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

async function lerConfig(admin: any, empresaId: string) {
  try {
    const { data } = await admin.from('config_ingestao_ccb')
      .select('modelo, confianca_minima').eq('empresa_id', empresaId).maybeSingle();
    return data || null;
  } catch { return null; }
}
async function logTentativa(admin: any, row: Record<string, unknown>) {
  try { await admin.from('ingestao_tentativas').insert(row); } catch { /* noop */ }
}
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
  const revisaoForcada = confianca != null && confMin != null && confianca < confMin;
  if (revisaoForcada) push('confianca', 'critica', confianca, confMin, `Confiança ${Math.round((confianca as number) * 100)}% abaixo do limite (${Math.round(confMin * 100)}%). Revisão obrigatória.`);

  // Conferência de habilitação: o CNPJ da empresa deve constar na CCB (credor OU correspondente).
  try {
    const { data: emp } = await admin.from('empresas').select('cnpj').eq('id', empresaId).maybeSingle();
    const empCnpj = soDigitos(emp?.cnpj);
    if (empCnpj) {
      const doc = [soDigitos(ext.credor_cnpj), soDigitos(ext.correspondente_cnpj)].filter(Boolean) as string[];
      const rot = [S(ext.credor_cnpj), S(ext.correspondente_cnpj)].filter(Boolean).join(' / ') || null;
      if (doc.length && !doc.includes(empCnpj)) {
        push('cnpj_empresa', 'aviso', emp?.cnpj, rot, `CNPJ da empresa (${emp?.cnpj}) não confere com o credor/correspondente da CCB — verifique a habilitação para operar.`);
      } else if (!doc.length) {
        push('cnpj_empresa', 'aviso', emp?.cnpj, null, 'CCB sem CNPJ de credor/correspondente para conferir a habilitação da empresa.');
      }
    }
  } catch { /* best-effort */ }

  const dados = {
    numero_ccb: numeroCcb, data_emissao: S(ext.data_emissao), modalidade: S(ext.modalidade), praca_pagamento: S(ext.praca_pagamento),
    cpf, nome_cliente: S(ext.nome_cliente), rg: S(ext.rg), orgao_expedidor: S(ext.orgao_expedidor),
    data_nascimento: S(ext.data_nascimento), estado_civil: S(ext.estado_civil), nacionalidade: S(ext.nacionalidade),
    naturalidade: S(ext.naturalidade), profissao: S(ext.profissao), email: S(ext.email), telefone: S(ext.telefone),
    endereco: S(ext.endereco), numero_endereco: S(ext.numero_endereco), complemento: S(ext.complemento),
    bairro: S(ext.bairro), cidade: S(ext.cidade), uf: S(ext.uf), cep: S(ext.cep),
    convenio: S(ext.convenio), matricula: S(ext.matricula), orgao_empregador: S(ext.orgao_empregador),
    credor_nome: S(ext.credor_nome), credor_cnpj: S(ext.credor_cnpj),
    correspondente_nome: S(ext.correspondente_nome), correspondente_cnpj: S(ext.correspondente_cnpj),
    valor_principal: vPrinc, valor_liberado: numOrNull(ext.valor_liberado), valor_total: vTotal,
    taxa_mensal: vTaxa, taxa_anual: numOrNull(ext.taxa_anual), cet_mensal: numOrNull(ext.cet_mensal), cet_anual: numOrNull(ext.cet_anual),
    iof: numOrNull(ext.iof), tarifa_cadastro: numOrNull(ext.tarifa_cadastro),
    prazo: vPrazo, valor_parcela: vPmt, primeiro_vencimento: S(ext.primeiro_vencimento), ultimo_vencimento: S(ext.ultimo_vencimento),
    banco_credito: S(ext.banco_credito), agencia_credito: S(ext.agencia_credito), conta_credito: S(ext.conta_credito), tipo_conta: S(ext.tipo_conta),
  };

  return { dados, divergencias, confianca, acao, propostaId, revisaoForcada };
}

// Faz a extração completa e grava o resultado. Roda em background (waitUntil).
async function processar(admin: any, anthKey: string, ing: any, modeloPedido: string | null, modeloFallback: string, criadoPor: string) {
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
      revisao_forcada: a.revisaoForcada, reprocessamento: !!modeloPedido, criado_por: criadoPor,
    });
  } catch (e) {
    await admin.from('ingestoes_documento').update({ status: 'erro', observacao: (e as Error).message }).eq('id', ing.id);
    await logTentativa(admin, { empresa_id: ing.empresa_id, ingestao_id: ing.id, arquivo_nome: ing.arquivo_nome, modelo: model, status: 'erro', duracao_ms: Date.now() - t0, erro: (e as Error).message, reprocessamento: !!modeloPedido, criado_por: criadoPor });
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors() });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anthKey = Deno.env.get('ANTHROPIC_API_KEY');
  const modeloFallback = Deno.env.get('CLAUDE_MODEL') || 'claude-sonnet-5';
  if (!url || !serviceKey) return json({ error: 'Configuração ausente (service role).' }, 500);
  if (!anthKey) return json({ error: 'ANTHROPIC_API_KEY não configurada no Supabase.' }, 500);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // Autorização: admin/superadmin (JWT do chamador).
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!token) return json({ error: 'Não autenticado' }, 401);
  const { data: caller } = await admin.auth.getUser(token);
  if (!caller?.user) return json({ error: 'Sessão inválida' }, 401);
  const { data: perfil } = await admin.from('usuarios').select('role, empresa_id').eq('id', caller.user.id).single();
  if (!perfil || !['admin', 'superadmin'].includes(perfil.role)) return json({ error: 'Sem permissão' }, 403);

  const body = await req.json().catch(() => ({}));
  const ingestaoId: string = body.ingestao_id || '';
  const modeloPedido = MODELOS_OK.includes(body.modelo) ? body.modelo : null;
  if (!ingestaoId) return json({ error: 'ingestao_id é obrigatório.' }, 400);

  const { data: ing } = await admin.from('ingestoes_documento')
    .select('id, empresa_id, storage_path, arquivo_nome, status, tipo_documento').eq('id', ingestaoId).maybeSingle();
  if (!ing) return json({ error: 'Ingestão não encontrada.' }, 404);
  if (ing.tipo_documento !== 'ccb') return json({ error: 'Esta ingestão não é uma CCB.' }, 400);
  if (perfil.role !== 'superadmin' && ing.empresa_id !== perfil.empresa_id) return json({ error: 'Sem permissão nesta ingestão.' }, 403);
  if (ing.status === 'aprovado') return json({ error: 'Ingestão já aprovada — não pode ser reprocessada.' }, 409);

  // Marca 'extraindo' e dispara a extração em BACKGROUND (waitUntil) — responde já.
  await admin.from('ingestoes_documento').update({ status: 'extraindo', observacao: null }).eq('id', ing.id);
  const work = processar(admin, anthKey, ing, modeloPedido, modeloFallback, caller.user.id);
  try { EdgeRuntime.waitUntil(work); } catch { await work; }

  return json({ id: ing.id, status: 'extraindo', pendente: true });
});

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}
function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json', ...cors() } });
}
