import { createClient } from 'npm:@supabase/supabase-js@2';

// Ingestão e leitura automática de DECRETOS/LEIS de consignação (regras do ente).
// Reusa a espinha da CCB: PDF (base64) → idempotência por hash → Storage privado
// → extração com o Claude (PDF nativo → OCR quando digitalizado) → SUGESTÃO de
// regras + match do convênio. NADA é gravado no convênio aqui: a saída é uma
// sugestão para conferência humana (aprovar_decreto → aplicar_regras_decreto).
//
// Modelo e limite de confiança vêm de config_ingestao_ccb (POR EMPRESA);
// fallback: secret CLAUDE_MODEL → claude-sonnet-5. Cada leitura registra uma
// linha em ingestao_tentativas. Reprocessamento: body.reprocessar_ingestao_id.
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
// ANTHROPIC_API_KEY, (opc) CLAUDE_MODEL.

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
  const n = Number(String(v).replace(/[%\s]/g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const intOrNull = (v: unknown) => { const n = numOrNull(v); return n == null ? null : Math.round(n); };
const S = (v: unknown) => { const s = v == null ? '' : String(v).trim(); return s === '' ? null : s; };
const arr = (v: unknown): string[] => Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];

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

const EXTRACT_TOOL = {
  name: 'extrair_decreto',
  description: 'Extrai as regras de consignação de um DECRETO ou LEI municipal/estadual. Para campos ausentes use null — NUNCA "N/A" nem texto equivalente. Percentuais como número puro (ex.: 40, não "40%"). Datas em ISO (AAAA-MM-DD). Prazos em meses. NUNCA infira ou calcule valores que não constem do texto.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      // Identificação da norma
      decreto_numero: { type: ['string', 'null'], description: 'Número do decreto/lei (ex.: "4.572")' },
      decreto_data: { type: ['string', 'null'], description: 'Data do decreto (ISO)' },
      ente_nome: { type: ['string', 'null'], description: 'Município ou órgão a que a norma se aplica' },
      uf: { type: ['string', 'null'], description: 'UF (sigla)' },
      esfera: { type: ['string', 'null'], description: 'municipal | estadual | federal' },
      lei_base: { type: ['string', 'null'], description: 'Lei que o decreto regulamenta/altera (ex.: "Lei 871/2005")' },
      // Regras de margem/prazo
      margem_total_pct: { type: ['number', 'null'], description: 'Margem consignável total autorizada, em %' },
      margem_cartao_pct: { type: ['number', 'null'], description: 'Parcela exclusiva de cartão de crédito, em % (dentro do total)' },
      prazo_maximo_meses: { type: ['integer', 'null'], description: 'Prazo máximo de parcelamento, em meses' },
      limite_adiantamento_pct: { type: ['number', 'null'], description: 'Limite de adiantamento de remuneração, em %' },
      recomposicao_margem_horas: { type: ['integer', 'null'], description: 'Prazo (h) para recompor a margem após liquidação antecipada' },
      reposicao_erario: { type: ['string', 'null'], description: 'Regra de reposição/desconto ao erário (ex.: "1/3 da remuneração")' },
      prioridade_desconto: { type: ['integer', 'null'], description: 'Ordem numérica de prioridade do desconto, se houver' },
      prioridade_desconto_descricao: { type: ['string', 'null'], description: 'Descrição da ordem de prioridade do desconto em folha' },
      // Listas
      tipos_consignacao_permitidos: { type: ['array', 'null'], items: { type: 'string' }, description: 'Tipos/modalidades de consignação facultativa permitidos' },
      consignatarias_habilitadas: { type: ['array', 'null'], items: { type: 'string' }, description: 'Consignatárias/instituições habilitadas nominalmente' },
      // Vigência
      vigencia: { type: ['string', 'null'], description: 'Vigência / data de entrada em vigor' },
      revogacoes: { type: ['string', 'null'], description: 'Normas revogadas por este decreto' },
      confianca: { type: 'number', description: 'Confiança geral da extração, 0 a 1' },
    },
    required: ['decreto_numero', 'ente_nome', 'confianca'],
  },
};

async function extrairComClaude(apiKey: string, model: string, base64: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model, max_tokens: 2048,
      tools: [EXTRACT_TOOL], tool_choice: { type: 'tool', name: 'extrair_decreto' },
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
          { type: 'text', text: 'Extraia as regras de consignação deste decreto/lei usando a ferramenta extrair_decreto. Para o que não constar, retorne null (nunca "N/A"). Não invente nem calcule nada.' },
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

// Normaliza para comparação de nomes (sem acento, minúsculo).
function norm(s: string): string {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Monta o objeto de regras + tenta casar o convênio + lista divergências
// (regra sugerida × valor atual do convênio) para a conferência.
async function analisar(admin: any, empresaId: string, ext: Record<string, unknown>, confMin: number) {
  const confianca = numOrNull(ext.confianca);
  const dados = {
    decreto_numero: S(ext.decreto_numero), decreto_data: S(ext.decreto_data),
    ente_nome: S(ext.ente_nome), uf: S(ext.uf), esfera: S(ext.esfera), lei_base: S(ext.lei_base),
    margem_total_pct: numOrNull(ext.margem_total_pct), margem_cartao_pct: numOrNull(ext.margem_cartao_pct),
    prazo_maximo_meses: intOrNull(ext.prazo_maximo_meses), limite_adiantamento_pct: numOrNull(ext.limite_adiantamento_pct),
    recomposicao_margem_horas: intOrNull(ext.recomposicao_margem_horas), reposicao_erario: S(ext.reposicao_erario),
    prioridade_desconto: intOrNull(ext.prioridade_desconto), prioridade_desconto_descricao: S(ext.prioridade_desconto_descricao),
    tipos_consignacao_permitidos: arr(ext.tipos_consignacao_permitidos),
    consignatarias_habilitadas: arr(ext.consignatarias_habilitadas),
    vigencia: S(ext.vigencia), revogacoes: S(ext.revogacoes),
  };

  // Match do convênio por nome/órgão do ente (best-effort — o operador confirma).
  let convenioSugerido: { id: string; nome: string } | null = null;
  const alvo = norm(dados.ente_nome || '');
  if (alvo) {
    const { data: convs } = await admin.from('convenios')
      .select('id, nome, orgao').eq('empresa_id', empresaId).eq('ativo', true);
    const hit = (convs || []).find((c: any) => {
      const n = norm(c.nome || ''), o = norm(c.orgao || '');
      return n && (n.includes(alvo) || alvo.includes(n)) || (o && (o.includes(alvo) || alvo.includes(o)));
    });
    if (hit) convenioSugerido = { id: hit.id, nome: hit.nome };
  }

  // Divergências (informativas) contra o convênio sugerido.
  const divergencias: Record<string, unknown>[] = [];
  if (convenioSugerido) {
    const { data: cv } = await admin.from('convenios')
      .select('teto_parcelas, prazo_maximo, margem_por_produto, prioridade_desconto, margem_total_pct')
      .eq('id', convenioSugerido.id).maybeSingle();
    const atualPrazo = cv?.teto_parcelas ?? cv?.prazo_maximo ?? null;
    if (dados.prazo_maximo_meses != null && atualPrazo != null && dados.prazo_maximo_meses !== atualPrazo)
      divergencias.push({ campo: 'prazo_maximo_meses', tipo: 'aviso', extraido: dados.prazo_maximo_meses, sistema: atualPrazo, mensagem: 'Prazo máximo do decreto difere do convênio atual.' });
    const atualMargem = cv?.margem_total_pct ?? null;
    if (dados.margem_total_pct != null && atualMargem != null && Number(atualMargem) !== dados.margem_total_pct)
      divergencias.push({ campo: 'margem_total_pct', tipo: 'aviso', extraido: dados.margem_total_pct, sistema: atualMargem, mensagem: 'Margem total do decreto difere do convênio atual.' });
  } else if (alvo) {
    divergencias.push({ campo: 'convenio', tipo: 'aviso', extraido: dados.ente_nome, sistema: null, mensagem: 'Nenhum convênio casou automaticamente — selecione manualmente na conferência.' });
  }

  const revisaoForcada = confianca != null && confMin != null && confianca < confMin;
  if (revisaoForcada) divergencias.push({ campo: 'confianca', tipo: 'critica', extraido: confianca, sistema: confMin, mensagem: `Confiança ${Math.round((confianca as number) * 100)}% abaixo do limite (${Math.round(confMin * 100)}%). Revisão obrigatória.` });

  return { dados, divergencias, confianca, convenioSugerido, revisaoForcada };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Método não permitido' }, { status: 405 });
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anthKey = Deno.env.get('ANTHROPIC_API_KEY');
  const modeloFallback = Deno.env.get('CLAUDE_MODEL') || 'claude-sonnet-5';
  if (!url || !serviceKey) return Response.json({ error: 'Configuração ausente (service role).' }, { status: 500 });

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!token) return Response.json({ error: 'Não autenticado' }, { status: 401 });
  const { data: caller } = await admin.auth.getUser(token);
  if (!caller?.user) return Response.json({ error: 'Sessão inválida' }, { status: 401 });
  const { data: perfil } = await admin.from('usuarios').select('role, empresa_id').eq('id', caller.user.id).single();
  if (!perfil || !['admin', 'superadmin'].includes(perfil.role)) return Response.json({ error: 'Sem permissão' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const modeloPedido = MODELOS_OK.includes(body.modelo) ? body.modelo : null;

  // ---------------------------------------------------------------
  // BRANCH A — Reprocessar um decreto existente com outro modelo.
  // ---------------------------------------------------------------
  if (body.reprocessar_ingestao_id) {
    const { data: ing } = await admin.from('ingestoes_documento')
      .select('id, empresa_id, storage_path, arquivo_nome, status, tipo_documento').eq('id', body.reprocessar_ingestao_id).maybeSingle();
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
        status: 'aguardando_conferencia', convenio_id: a.convenioSugerido?.id ?? null,
        dados_extraidos: a.dados, divergencias: a.divergencias, confianca: a.confianca,
      }).eq('id', ing.id);
      await setModeloUsado(admin, ing.id, model);
      await logTentativa(admin, {
        empresa_id: ing.empresa_id, ingestao_id: ing.id, arquivo_nome: ing.arquivo_nome, modelo: model,
        status: 'ok', tokens_entrada: usage?.input_tokens ?? null, tokens_saida: usage?.output_tokens ?? null,
        custo_usd: custoUsd(model, usage), duracao_ms: Date.now() - t0, confianca: a.confianca,
        revisao_forcada: a.revisaoForcada, reprocessamento: true, criado_por: caller.user.id,
      });
      return Response.json({ id: ing.id, status: 'aguardando_conferencia', modelo_usado: model, convenio_sugerido: a.convenioSugerido, dados_extraidos: a.dados, divergencias: a.divergencias, confianca: a.confianca });
    } catch (e) {
      await admin.from('ingestoes_documento').update({ status: 'erro', observacao: (e as Error).message }).eq('id', ing.id);
      await setModeloUsado(admin, ing.id, model);
      await logTentativa(admin, { empresa_id: ing.empresa_id, ingestao_id: ing.id, arquivo_nome: ing.arquivo_nome, modelo: model, status: 'erro', duracao_ms: Date.now() - t0, erro: (e as Error).message, reprocessamento: true, criado_por: caller.user.id });
      return Response.json({ id: ing.id, status: 'erro', error: (e as Error).message }, { status: 200 });
    }
  }

  // ---------------------------------------------------------------
  // BRANCH B — Novo decreto a partir do PDF enviado.
  // ---------------------------------------------------------------
  const base64: string = body.arquivo_base64 || '';
  const arquivoNome: string = body.arquivo_nome || 'decreto.pdf';
  if (!base64) return Response.json({ error: 'arquivo_base64 é obrigatório.' }, { status: 400 });
  const empresaId = (perfil.role === 'superadmin' && body.empresa_id) ? body.empresa_id : perfil.empresa_id;
  if (!empresaId) return Response.json({ error: 'Usuário sem empresa.' }, { status: 400 });

  let bytes: Uint8Array;
  try { bytes = b64ToBytes(base64); } catch { return Response.json({ error: 'base64 inválido.' }, { status: 400 }); }
  const hash = await sha256Hex(bytes);

  const { data: existente } = await admin.from('ingestoes_documento')
    .select('id, status, convenio_id').eq('empresa_id', empresaId).eq('hash_sha256', hash).maybeSingle();
  if (existente) {
    await logTentativa(admin, { empresa_id: empresaId, ingestao_id: existente.id, arquivo_nome: arquivoNome, status: 'duplicado', criado_por: caller.user.id });
    return Response.json({ id: existente.id, duplicado: true, ...existente });
  }

  // Gate de cota do plano — bloqueia ao exceder ANTES de gastar IA/storage.
  try {
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (anonKey) {
      const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { autoRefreshToken: false, persistSession: false } });
      const pEmp = (perfil.role === 'superadmin' && body.empresa_id) ? body.empresa_id : null;
      const { data: cota } = await userClient.rpc('uso_ingestao_empresa', { p_empresa: pEmp });
      if (cota?.bloqueia) return Response.json({ error: cota.motivo || 'Cota do plano excedida.' }, { status: 402 });
    }
  } catch { /* não bloqueia se a checagem falhar */ }

  const cfg = await lerConfig(admin, empresaId);
  const model = modeloPedido || cfg?.modelo || modeloFallback;
  const confMin = cfg?.confianca_minima != null ? Number(cfg.confianca_minima) : 0.75;

  const _now = new Date();
  const _yyyy = _now.getUTCFullYear();
  const storagePath = `${empresaId}/decretos/${_yyyy}/${hash}.pdf`;
  try {
    await admin.storage.from('ccb-docs').upload(storagePath, bytes, { contentType: 'application/pdf', upsert: true });
  } catch { /* segue mesmo se o upload falhar */ }

  const { data: ing, error: insErr } = await admin.from('ingestoes_documento').insert({
    empresa_id: empresaId, tipo_documento: 'decreto', arquivo_nome: arquivoNome, storage_path: storagePath,
    hash_sha256: hash, status: 'extraindo', enviado_por: caller.user.id,
  }).select().single();
  if (insErr) return Response.json({ error: insErr.message }, { status: 400 });
  try { await admin.from('ingestoes_documento').update({ tamanho_bytes: bytes.length }).eq('id', ing.id); } catch { /* pré-0092 */ }

  const t0 = Date.now();
  try {
    if (!anthKey) throw new Error('ANTHROPIC_API_KEY não configurada.');
    const { input: ext, usage } = await extrairComClaude(anthKey, model, base64.replace(/^data:.*;base64,/, ''));
    const a = await analisar(admin, empresaId, ext, confMin);

    await admin.from('ingestoes_documento').update({
      status: 'aguardando_conferencia', convenio_id: a.convenioSugerido?.id ?? null,
      dados_extraidos: a.dados, divergencias: a.divergencias, confianca: a.confianca,
    }).eq('id', ing.id);
    await setModeloUsado(admin, ing.id, model);

    await logTentativa(admin, {
      empresa_id: empresaId, ingestao_id: ing.id, arquivo_nome: arquivoNome, modelo: model,
      status: 'ok', tokens_entrada: usage?.input_tokens ?? null, tokens_saida: usage?.output_tokens ?? null,
      custo_usd: custoUsd(model, usage), duracao_ms: Date.now() - t0, confianca: a.confianca,
      revisao_forcada: a.revisaoForcada, reprocessamento: false, criado_por: caller.user.id,
    });

    return Response.json({ id: ing.id, status: 'aguardando_conferencia', modelo_usado: model, convenio_sugerido: a.convenioSugerido, dados_extraidos: a.dados, divergencias: a.divergencias, confianca: a.confianca });
  } catch (e) {
    await admin.from('ingestoes_documento').update({ status: 'erro', observacao: (e as Error).message }).eq('id', ing.id);
    await setModeloUsado(admin, ing.id, model);
    await logTentativa(admin, { empresa_id: empresaId, ingestao_id: ing.id, arquivo_nome: arquivoNome, modelo: model, status: 'erro', duracao_ms: Date.now() - t0, erro: (e as Error).message, reprocessamento: false, criado_por: caller.user.id });
    return Response.json({ id: ing.id, status: 'erro', error: (e as Error).message }, { status: 200 });
  }
});
