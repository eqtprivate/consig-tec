import { createClient } from 'npm:@supabase/supabase-js@2';

// Sincronização (FULL SYNC) do espelho de convênios a partir da API PixConsig v1.
// Percorre GET {PIXCONSIG_BASE_URL}/v1/convenios paginado (x-api-key) e faz
// upsert em entidades_cadastro + convenios por pixconsig_convenio_id.
// NÃO toca em overlay_comercial_convenio nem produtos_convenio (taxa/spread/
// comissão/prazos são do CONSIGTEC). REPROVADA é ignorada por padrão.
// Requer secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PIXCONSIG_BASE_URL,
// PIXCONSIG_API_KEY. Pode ser chamada por admin (com token) ou pelo cron
// (header x-sync-token = PIXCONSIG_SYNC_TOKEN).

const soDigitos = (v: unknown) => (v ? String(v).replace(/\D/g, '') : null);
const soData = (v: unknown) => (v ? String(v).slice(0, 10) : null);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Método não permitido' }, { status: 405 });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const baseUrl = Deno.env.get('PIXCONSIG_BASE_URL');
  const apiKey = Deno.env.get('PIXCONSIG_API_KEY');
  const syncToken = Deno.env.get('PIXCONSIG_SYNC_TOKEN');
  if (!url || !serviceKey) return Response.json({ error: 'Configuração ausente (SUPABASE_SERVICE_ROLE_KEY).' }, { status: 500 });
  if (!baseUrl || !apiKey) return Response.json({ error: 'PIXCONSIG_BASE_URL / PIXCONSIG_API_KEY não configurados.', configurado: false }, { status: 200 });

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // Autorização: token de cron (header) OU sessão de admin.
  const cronToken = req.headers.get('x-sync-token');
  let autorizado = !!(syncToken && cronToken && cronToken === syncToken);
  if (!autorizado) {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
    if (!token) return Response.json({ error: 'Não autenticado' }, { status: 401 });
    const { data: caller } = await admin.auth.getUser(token);
    if (!caller?.user) return Response.json({ error: 'Sessão inválida' }, { status: 401 });
    const { data: perfil } = await admin.from('usuarios').select('role').eq('id', caller.user.id).single();
    if (!perfil || !['admin', 'superadmin'].includes(perfil.role)) return Response.json({ error: 'Sem permissão' }, { status: 403 });
    autorizado = true;
  }

  const body = await req.json().catch(() => ({}));
  const incluirReprovadas = !!body.incluirReprovadas;
  const now = new Date().toISOString();
  const res = { total: 0, ok: 0, ignorados: 0, paginas: 0, erros: [] as string[] };

  try {
    let page = 1;
    const pageSize = 200;
    for (;;) {
      const endpoint = `${baseUrl.replace(/\/$/, '')}/v1/convenios?page=${page}&page_size=${pageSize}`;
      const r = await fetch(endpoint, { headers: { 'x-api-key': apiKey, Accept: 'application/json' } });
      if (!r.ok) {
        res.erros.push(`HTTP ${r.status} na página ${page}`);
        break;
      }
      const json = await r.json();
      const lista = Array.isArray(json) ? json : (json?.data || []);
      res.paginas++;

      for (const item of lista) {
        res.total++;
        try {
          const ent = item.entidade || {};
          const cred = item.credenciamento || {};
          const norma = item.norma_autorizadora || {};
          const capag = item.capag || {};
          const averb = item.averbacao || {};
          const prod = (item.produtos && item.produtos[0]) || {};
          if (!item.id) throw new Error('sem id');
          if (!incluirReprovadas && String(cred.status_detalhado || '').toUpperCase() === 'REPROVADA') { res.ignorados++; continue; }

          const cnpj = soDigitos(ent.cnpj);
          const nome = ent.nome_oficial || ent.cidade || item.id;
          const cidade = ent.cidade || null;
          const uf = ent.uf || null;

          const entPayload: Record<string, unknown> = {
            nome, cnpj, cidade, uf,
            codigo_ibge: ent.codigo_ibge || null,
            populacao: ent.populacao ?? null,
            servidores: ent.servidores ?? null,
            norma_autorizadora: norma.tipo || null,
            sistema_averbacao: averb.sistema || null,
            vigencia_inicio: soData(cred.vigencia_inicio),
            vigencia_fim: soData(cred.vigencia_fim),
            capag: capag.classificacao || null,
            origem_dado: 'pixconsig', ultima_sincronizacao: now, status_sync: 'ok',
          };

          // encontrar entidade por cnpj, senão por nome(+cidade+uf)
          let entidadeId: string | null = null;
          if (cnpj) {
            const { data } = await admin.from('entidades_cadastro').select('id').eq('cnpj', cnpj).limit(1);
            if (data && data[0]) entidadeId = data[0].id;
          }
          if (!entidadeId && nome) {
            let q = admin.from('entidades_cadastro').select('id').eq('nome', nome);
            if (cidade) q = q.eq('cidade', cidade);
            if (uf) q = q.eq('uf', uf);
            const { data } = await q.limit(1);
            if (data && data[0]) entidadeId = data[0].id;
          }
          if (entidadeId) await admin.from('entidades_cadastro').update(entPayload).eq('id', entidadeId);
          else {
            const { data } = await admin.from('entidades_cadastro').insert(entPayload).select('id').single();
            entidadeId = data?.id ?? null;
          }

          const convenio = {
            pixconsig_convenio_id: item.id,
            nome, orgao: cidade, tipo: 'publico', entidade_id: entidadeId,
            tipo_margem: prod.tipo_margem || 'cartao',
            percentual_margem_apartada: prod.percentual_margem_apartada ?? null,
            margem_consignavel: prod.percentual_margem_apartada ?? null,
            margem_disponivel: prod.margem_disponivel ?? null,
            capag: capag.classificacao || null,
            arquivo_decreto_url: norma.arquivo_decreto_url || null,
            norma_autorizadora: norma.tipo || null,
            status_detalhado: cred.status_detalhado || null,
            decreto_enviado: cred.decreto_enviado ?? null,
            data_atribuicao: cred.data_atribuicao || null,
            origem_dado: 'pixconsig', ultima_sincronizacao: now, status_sync: 'ok',
            ativo: cred.status === 'ativo',
          };
          const { error } = await admin.from('convenios').upsert(convenio, { onConflict: 'pixconsig_convenio_id' });
          if (error) throw new Error(error.message);
          res.ok++;
        } catch (e) {
          res.erros.push(`Item ${item?.id || '?'}: ${(e as Error).message}`);
        }
      }

      const hasNext = !Array.isArray(json) && json?.pagination?.has_next;
      if (!hasNext || lista.length === 0) break;
      page++;
      if (page > 200) { res.erros.push('Limite de páginas atingido (200).'); break; }
    }

    // Auditoria da sincronização
    await admin.from('auditoria').insert({
      entidade: 'convenios', registro_id: null, acao: 'sync_pixconsig',
      valor_novo: { total: res.total, ok: res.ok, ignorados: res.ignorados, paginas: res.paginas, erros: res.erros.length },
    });

    return Response.json({ configurado: true, ...res });
  } catch (e) {
    return Response.json({ error: (e as Error).message, ...res }, { status: 500 });
  }
});
