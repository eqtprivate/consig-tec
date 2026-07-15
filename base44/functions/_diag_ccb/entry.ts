// TEMPORÁRIO — mede tempo/sucesso da extração de CCB longa. REMOVER após medir.
const GATE = '6948613d993f35bb74bc9b2d19d36da74366';
const EXTRACT_TOOL = {
  name: 'extrair_ccb',
  description: 'Extrai campos de uma CCB. Retorne null quando não constar. NUNCA calcule.',
  input_schema: {
    type: 'object', additionalProperties: false,
    properties: {
      numero_ccb: { type: ['string', 'null'] }, cpf: { type: ['string', 'null'] },
      nome_cliente: { type: ['string', 'null'] }, convenio: { type: ['string', 'null'] },
      valor_principal: { type: ['number', 'null'] }, valor_total: { type: ['number', 'null'] },
      taxa_mensal: { type: ['number', 'null'] }, prazo: { type: ['integer', 'null'] },
      valor_parcela: { type: ['number', 'null'] }, data_emissao: { type: ['string', 'null'] },
      primeiro_vencimento: { type: ['string', 'null'] }, confianca: { type: 'number' },
    },
    required: ['numero_ccb', 'cpf', 'valor_principal', 'prazo', 'valor_parcela', 'confianca'],
  },
};
Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });
  const body = await req.json().catch(() => ({}));
  if (body.token !== GATE) return Response.json({ error: 'forbidden' }, { status: 403 });
  const anthKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthKey) return Response.json({ key_present: false });
  const model = body.model || Deno.env.get('CLAUDE_MODEL') || 'claude-sonnet-5';
  const base64 = (body.arquivo_base64 as string || '').replace(/^data:.*;base64,/, '');
  const t0 = Date.now();
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': anthKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model, max_tokens: 1024, tools: [EXTRACT_TOOL], tool_choice: { type: 'tool', name: 'extrair_ccb' },
        messages: [{ role: 'user', content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
          { type: 'text', text: 'Extraia os campos desta CCB usando a ferramenta extrair_ccb.' },
        ] }],
      }),
    });
    const j = await res.json().catch(() => ({}));
    const tu = (j.content || []).find((b: any) => b.type === 'tool_use');
    return Response.json({ model, http: res.status, elapsed_ms: Date.now() - t0, usage: j.usage || null, ok: !!tu, extracted: tu ? tu.input : (j.error || j) });
  } catch (e) {
    return Response.json({ model, elapsed_ms: Date.now() - t0, exception: (e as Error).message });
  }
});
