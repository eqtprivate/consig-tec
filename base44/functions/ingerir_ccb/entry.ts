import { createClient } from 'npm:@supabase/supabase-js@2';

// Ingestão e leitura automática de CCB. Recebe o PDF (base64), garante
// idempotência por hash, sobe ao Storage privado, extrai os dados com a API do
// Claude (PDF nativo → OCR quando digitalizado), faz o matching e valida.
// NADA é gravado no negócio aqui — a saída é uma SUGESTÃO para conferência.
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY,
// (opcional) CLAUDE_MODEL.

const numOrNull = (v: unknown) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[R$\s.]/g, (m) => (m === ',' ? '.' : '')).replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const soDig = (v: unknown) => (v ? String(v).replace(/\D/g, '') : '');

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
      numero_ccb: { type: ['string', 'null'] },
      cpf: { type: ['string', 'null'], description: 'Somente dígitos' },
      nome_cliente: { type: ['string', 'null'] },
      convenio: { type: ['string', 'null'] },
      valor_principal: { type: ['number', 'null'], description: 'Valor financiado / principal' },
      valor_total: { type: ['number', 'null'], description: 'Valor total / a pagar' },
      taxa_mensal: { type: ['number', 'null'], description: 'Taxa de juros ao mês, em %' },
      prazo: { type: ['integer', 'null'], description: 'Número de parcelas' },
      valor_parcela: { type: ['number', 'null'], description: 'Valor da parcela (PMT) conforme a CCB' },
      data_emissao: { type: ['string', 'null'] },
      primeiro_vencimento: { type: ['string', 'null'] },
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
      model, max_tokens: 1024,
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
  return tu.input as Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Método não permitido' }, { status: 405 });
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anthKey = Deno.env.get('ANTHROPIC_API_KEY');
  const model = Deno.env.get('CLAUDE_MODEL') || 'claude-sonnet-5';
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
  if (existente) return Response.json({ id: existente.id, duplicado: true, ...existente });

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

  try {
    if (!anthKey) throw new Error('ANTHROPIC_API_KEY não configurada.');
    const ext = await extrairComClaude(anthKey, model, base64.replace(/^data:.*;base64,/, ''));

    // normaliza
    const numeroCcb = (ext.numero_ccb ? String(ext.numero_ccb).trim() : '') || null;
    const cpf = soDig(ext.cpf);
    const vPrinc = numOrNull(ext.valor_principal);
    const vTotal = numOrNull(ext.valor_total);
    const vTaxa = numOrNull(ext.taxa_mensal);
    const vPrazo = ext.prazo ? Math.round(Number(ext.prazo)) : null;
    const vPmt = numOrNull(ext.valor_parcela);
    const confianca = numOrNull(ext.confianca);

    // ---- Matching ----
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

    // ---- Validações → divergências ----
    const divergencias: Record<string, unknown>[] = [];
    const push = (campo: string, tipo: 'critica' | 'aviso', extraido: unknown, sistema: unknown, msg: string) =>
      divergencias.push({ campo, tipo, extraido, sistema, mensagem: msg });

    // PMT recalculado × PMT da CCB
    if (vPrinc != null && vPrazo && vPmt != null) {
      const calc = pmt(vPrinc, vTaxa || 0, vPrazo);
      if (calc != null) {
        const tol = Math.max(vPmt * 0.02, 0.5);
        if (Math.abs(calc - vPmt) > tol) push('valor_parcela', 'critica', vPmt, Number(calc.toFixed(2)), `PMT recalculado (${calc.toFixed(2)}) diverge do valor da CCB.`);
      }
    }
    // valor × proposta
    if (propostaId && vPrinc != null) {
      const { data: p } = await admin.from('propostas').select('valor_solicitado').eq('id', propostaId).maybeSingle();
      const vs = Number(p?.valor_solicitado || 0);
      if (vs && Math.abs(vs - vPrinc) > Math.max(vs * 0.02, 1)) push('valor_principal', 'critica', vPrinc, vs, 'Valor da CCB diverge da proposta.');
    }
    // CPF
    if (cpf && !cpfValido(cpf)) push('cpf', 'critica', cpf, null, 'CPF inválido.');
    if (!cpf) push('cpf', 'aviso', null, null, 'CPF não encontrado no documento.');
    // coerência das parcelas
    if (vTotal != null && vPmt != null && vPrazo) {
      const esperado = vPmt * vPrazo;
      if (Math.abs(esperado - vTotal) > Math.max(vTotal * 0.03, 1)) push('valor_total', 'aviso', vTotal, Number(esperado.toFixed(2)), 'Valor total ≠ parcela × prazo.');
    }

    const dados = { numero_ccb: numeroCcb, cpf, nome_cliente: ext.nome_cliente ?? null, convenio: ext.convenio ?? null,
      valor_principal: vPrinc, valor_total: vTotal, taxa_mensal: vTaxa, prazo: vPrazo, valor_parcela: vPmt,
      data_emissao: ext.data_emissao ?? null, primeiro_vencimento: ext.primeiro_vencimento ?? null };

    await admin.from('ingestoes_documento').update({
      status: 'aguardando_conferencia', acao_sugerida: acao, proposta_id: propostaId,
      dados_extraidos: dados, divergencias, confianca,
    }).eq('id', ing.id);

    return Response.json({ id: ing.id, status: 'aguardando_conferencia', acao_sugerida: acao, proposta_id: propostaId, dados_extraidos: dados, divergencias, confianca });
  } catch (e) {
    await admin.from('ingestoes_documento').update({ status: 'erro', observacao: (e as Error).message }).eq('id', ing.id);
    return Response.json({ id: ing.id, status: 'erro', error: (e as Error).message }, { status: 200 });
  }
});
