// TEMPORÁRIO — valida a extração real do decreto pela IA (tool extrair_decreto)
// usando a ANTHROPIC_API_KEY do runtime. Recebe o TEXTO do decreto comprimido
// (gzip+base64) para caber no transporte. Token-gated. REMOVER após validar.

const EXTRACT_TOOL = {
  name: 'extrair_decreto',
  description: 'Extrai as regras de consignação de um DECRETO ou LEI. Para campos ausentes use null. Percentuais como número puro. Datas em ISO. Prazos em meses. NUNCA infira valores que não constem do texto.',
  input_schema: {
    type: 'object', additionalProperties: false,
    properties: {
      decreto_numero: { type: ['string', 'null'] }, decreto_data: { type: ['string', 'null'] },
      ente_nome: { type: ['string', 'null'] }, uf: { type: ['string', 'null'] }, esfera: { type: ['string', 'null'] },
      lei_base: { type: ['string', 'null'] },
      margem_total_pct: { type: ['number', 'null'] }, margem_cartao_pct: { type: ['number', 'null'] },
      prazo_maximo_meses: { type: ['integer', 'null'] }, limite_adiantamento_pct: { type: ['number', 'null'] },
      recomposicao_margem_horas: { type: ['integer', 'null'] }, reposicao_erario: { type: ['string', 'null'] },
      prioridade_desconto: { type: ['integer', 'null'] }, prioridade_desconto_descricao: { type: ['string', 'null'] },
      tipos_consignacao_permitidos: { type: ['array', 'null'], items: { type: 'string' } },
      consignatarias_habilitadas: { type: ['array', 'null'], items: { type: 'string' } },
      vigencia: { type: ['string', 'null'] }, revogacoes: { type: ['string', 'null'] },
      confianca: { type: 'number' },
    },
    required: ['decreto_numero', 'ente_nome', 'confianca'],
  },
};

async function gunzipB64(b64: string): Promise<string> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ds = new DecompressionStream('gzip');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return await new Response(stream).text();
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    if (body.token !== 'diag-decreto-2026') return Response.json({ error: 'forbidden' }, { status: 403 });
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return Response.json({ error: 'sem ANTHROPIC_API_KEY' }, { status: 200 });
    const model = body.modelo || 'claude-haiku-4-5';
    const texto = body.texto ? String(body.texto) : await gunzipB64(body.gzb64 || '');
    const t0 = Date.now();
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model, max_tokens: 2048,
        tools: [EXTRACT_TOOL], tool_choice: { type: 'tool', name: 'extrair_decreto' },
        messages: [{ role: 'user', content: [{ type: 'text', text: `Texto do decreto a seguir. Extraia as regras com a ferramenta extrair_decreto.\n\n${texto}` }] }],
      }),
    });
    if (!res.ok) return Response.json({ error: `Claude ${res.status}`, detail: (await res.text()).slice(0, 300) }, { status: 200 });
    const j = await res.json();
    const tu = (j.content || []).find((b: any) => b.type === 'tool_use');
    return Response.json({ model, chars_texto: texto.length, duracao_ms: Date.now() - t0, usage: j.usage, extraido: tu?.input || null });
  } catch (e) {
    return Response.json({ error: 'exception', detail: (e as Error).message }, { status: 200 });
  }
});
