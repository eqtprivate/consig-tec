// TEMPORÁRIO — diagnóstico de validação da leitura de CCB.
// Roda no runtime das funções (onde os secrets existem) e reporta se a
// ANTHROPIC_API_KEY está configurada e se a extração de PDF funciona.
// NUNCA retorna o valor da chave. Gated por token. REMOVER após validar.

const GATE = '6948613d993f35bb74bc9b2d19d36da74366';

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
      valor_principal: { type: ['number', 'null'] },
      valor_total: { type: ['number', 'null'] },
      taxa_mensal: { type: ['number', 'null'] },
      prazo: { type: ['integer', 'null'] },
      valor_parcela: { type: ['number', 'null'] },
      data_emissao: { type: ['string', 'null'] },
      primeiro_vencimento: { type: ['string', 'null'] },
      confianca: { type: 'number' },
    },
    required: ['numero_ccb', 'cpf', 'valor_principal', 'prazo', 'valor_parcela', 'confianca'],
  },
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });
  const body = await req.json().catch(() => ({}));
  if (body.token !== GATE) return Response.json({ error: 'forbidden' }, { status: 403 });

  const anthKey = Deno.env.get('ANTHROPIC_API_KEY');
  const model = Deno.env.get('CLAUDE_MODEL') || 'claude-sonnet-5';
  const keyPresent = !!anthKey;
  const keyPrefix = anthKey ? anthKey.slice(0, 7) : null; // ex.: "sk-ant-" — não é segredo
  const keyLen = anthKey ? anthKey.length : 0;

  const out: Record<string, unknown> = { key_present: keyPresent, key_prefix: keyPrefix, key_len: keyLen, model };

  const base64 = body.arquivo_base64 as string | undefined;
  if (!keyPresent) { out.extraction = 'skipped: sem ANTHROPIC_API_KEY'; return Response.json(out); }
  if (!base64) { out.extraction = 'skipped: sem arquivo_base64'; return Response.json(out); }

  const t0 = Date.now();
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': anthKey!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model, max_tokens: 1024,
        tools: [EXTRACT_TOOL], tool_choice: { type: 'tool', name: 'extrair_ccb' },
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64.replace(/^data:.*;base64,/, '') } },
            { type: 'text', text: 'Extraia os campos desta CCB usando a ferramenta extrair_ccb. Retorne null para o que não constar. Não invente nem calcule nada.' },
          ],
        }],
      }),
    });
    out.claude_http_status = res.status;
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      out.extraction = 'erro';
      out.claude_error = JSON.stringify(j).slice(0, 400);
    } else {
      const tu = (j.content || []).find((b: any) => b.type === 'tool_use');
      out.extraction = tu ? 'ok' : 'sem tool_use';
      out.extracted = tu ? tu.input : null;
      out.usage = j.usage || null;
    }
  } catch (e) {
    out.extraction = 'exception';
    out.exception = (e as Error).message;
  }
  out.elapsed_ms = Date.now() - t0;
  return Response.json(out);
});
