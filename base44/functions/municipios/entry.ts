import { createClient } from 'npm:@supabase/supabase-js@2';

// API DE MUNICÍPIOS (CONSIGTEC → PixConsig) — Direção B da sincronização.
// Somente leitura. Expõe os municípios/convênios conhecidos pelo CONSIGTEC para
// a PixConsig ingerir/credenciar. Reconciliação por codigo_ibge.
//   GET /api/functions/municipios?origem=consigtec|todos&updated_since=&uf=&page=&page_size=
// Auth: header x-api-key == env MUNICIPIOS_API_KEY.
// origem=consigtec (default) → só os ainda NÃO vinculados à PixConsig
//   (pixconsig_convenio_id IS NULL). origem=todos → tudo.
// Sem PII de pessoa física — só cadastro institucional + status comercial.

const statusComercial = (row: Record<string, unknown>) =>
  row.pixconsig_convenio_id ? 'credenciado_pixconsig' : (row.ativo ? 'ativo' : 'prospeccao');

Deno.serve(async (req) => {
  if (req.method !== 'GET') return Response.json({ error: 'Somente GET' }, { status: 405 });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const apiKey = Deno.env.get('MUNICIPIOS_API_KEY');
  if (!url || !serviceKey) return Response.json({ error: 'Configuração ausente.' }, { status: 500 });
  if (!apiKey) return Response.json({ configurado: false, error: 'MUNICIPIOS_API_KEY não configurada.' }, { status: 503 });

  if ((req.headers.get('x-api-key') || '') !== apiKey) {
    return Response.json({ error: 'x-api-key inválida' }, { status: 401 });
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const qs = new URL(req.url).searchParams;
  const origem = (qs.get('origem') || 'consigtec').toLowerCase();
  const updatedSince = qs.get('updated_since');
  const uf = (qs.get('uf') || '').toUpperCase() || null;
  const page = Math.max(Number(qs.get('page')) || 1, 1);
  const pageSize = Math.min(Math.max(Number(qs.get('page_size')) || 100, 1), 200);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    // Filtro por UF → resolve entidade_ids da UF (uf vive em entidades_cadastro).
    let entidadeIds: string[] | null = null;
    if (uf) {
      const { data: ents } = await admin.from('entidades_cadastro').select('id').eq('uf', uf);
      entidadeIds = (ents || []).map((e: { id: string }) => e.id);
      if (entidadeIds.length === 0) {
        return Response.json({ data: [], pagination: { page, page_size: pageSize, total: 0, has_next: false } });
      }
    }

    let q = admin
      .from('convenios')
      .select(
        'id, pixconsig_convenio_id, orgao, ativo, origem_dado, prioridade_comercial, potencial_vendas, observacao_comercial, updated_at, entidade:entidades_cadastro(codigo_ibge, cnpj, cidade, uf, nome)',
        { count: 'exact' },
      )
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to);

    if (origem !== 'todos') q = q.is('pixconsig_convenio_id', null);
    if (updatedSince) q = q.gte('updated_at', updatedSince);
    if (entidadeIds) q = q.in('entidade_id', entidadeIds);

    const { data, count, error } = await q;
    if (error) return Response.json({ error: error.message }, { status: 400 });

    const items = (data || []).map((row: Record<string, any>) => {
      const ent = row.entidade || {};
      return {
        codigo_ibge: ent.codigo_ibge || null,
        cnpj: ent.cnpj || null,
        nome_oficial: ent.nome || row.orgao || null,
        cidade: ent.cidade || row.orgao || null,
        uf: ent.uf || null,
        origem: row.origem_dado || 'manual',
        pixconsig_convenio_id: row.pixconsig_convenio_id || null,
        status_comercial: statusComercial(row),
        prioridade_comercial: row.prioridade_comercial || null,
        potencial_vendas: row.potencial_vendas ?? null,
        observacao_comercial: row.observacao_comercial || null,
        updated_at: row.updated_at,
      };
    });

    const total = count ?? items.length;
    // Auditoria da leitura externa (best-effort).
    await admin.from('auditoria').insert({
      entidade: 'convenios', registro_id: null, acao: 'ler_municipios_pixconsig',
      valor_novo: { origem, uf, updated_since: updatedSince, page, page_size: pageSize, retornados: items.length },
    }).then(() => {}, () => {});

    return Response.json({
      data: items,
      pagination: { page, page_size: pageSize, total, has_next: to + 1 < total },
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
});
