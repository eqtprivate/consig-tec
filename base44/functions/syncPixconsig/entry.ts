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
const numOrNull = (v: unknown) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

// Contrato v1 produção: produtos[] é array; tipo_margem é enum cru da PixConsig.
const MARGEM_MAP: Record<string, string> = { CARTAO_BENEFICIO: 'cartao', CARTAO_CREDITO: 'cartao', EMPRESTIMO_CONSIGNADO: 'principal' };
const PRODUTO_MAP: Record<string, string> = { CARTAO_BENEFICIO: 'cartao_beneficio', CARTAO_CREDITO: 'cartao_credito', EMPRESTIMO_CONSIGNADO: 'consignado' };
const up = (v: unknown) => String(v || '').toUpperCase();
const mapMargem = (t: unknown) => MARGEM_MAP[up(t)] || 'cartao';
const mapProduto = (t: unknown) => PRODUTO_MAP[up(t)] || 'cartao_beneficio';

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
  const res = { total: 0, ok: 0, ignorados: 0, paginas: 0, erros: [] as string[], total_api: null as number | null, diag: null as unknown };

  try {
    let page = 1;
    const pageSize = 200;
    let totalApi: number | null = null;
    for (;;) {
      // baseUrl já inclui .../v1 (ex.: https://app.pixconsig.com.br/api/integration/v1)
      const endpoint = `${baseUrl.replace(/\/$/, '')}/convenios?page=${page}&page_size=${pageSize}`;
      // busca a página com até 2 retentativas (evita que um blip HTTP corte a paginação no meio)
      let r: Response | null = null;
      for (let tent = 0; tent < 3; tent++) {
        r = await fetch(endpoint, { headers: { 'x-api-key': apiKey, Accept: 'application/json' } });
        if (r.ok) break;
        if (tent < 2) await new Promise((s) => setTimeout(s, 500 * (tent + 1)));
      }
      if (!r || !r.ok) { res.erros.push(`HTTP ${r?.status ?? '?'} na página ${page} (após retentativas)`); break; }
      const json = await r.json();
      const lista = Array.isArray(json) ? json : (json?.data || json?.items || json?.results || json?.convenios || []);
      const pg = ((!Array.isArray(json) && (json.pagination || json.meta || json)) || {}) as Record<string, unknown>;
      // Diagnóstico da 1ª página: registra o formato real da resposta (para ajustar paginação).
      if (page === 1) {
        res.diag = Array.isArray(json)
          ? { formato: 'array', itens_pagina: lista.length }
          : { chaves: Object.keys(json), pagination: json.pagination ?? json.meta ?? null, itens_pagina: lista.length };
      }
      res.paginas++;

      for (const item of lista) {
        res.total++;
        try {
          const ent = item.entidade || {};
          const cred = item.credenciamento || {};
          const norma = item.norma_autorizadora || {};
          const capag = item.capag || {};
          const averb = item.averbacao || {};
          const margens = item.margens || {};
          const produtos = Array.isArray(item.produtos) ? item.produtos : [];
          const primary = produtos.find((p: Record<string, unknown>) => up(p.tipo_margem) === 'CARTAO_BENEFICIO') || produtos[0] || {};
          if (!item.id) throw new Error('sem id');
          if (!incluirReprovadas && up(cred.status_detalhado) === 'REPROVADA') { res.ignorados++; continue; }

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
            contatos: Array.isArray(averb.contatos_operacionais) ? averb.contatos_operacionais : [],
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

          const pctApartada = numOrNull(margens.decreto_cartao) ?? numOrNull(primary.percentual_margem);
          const convenio = {
            pixconsig_convenio_id: item.id,
            nome, orgao: cidade, tipo: 'publico', entidade_id: entidadeId,
            tipo_margem: mapMargem(primary.tipo_margem),
            percentual_margem_apartada: pctApartada,
            margem_consignavel: pctApartada,
            margem_disponivel: numOrNull(margens.disponivel),
            capag: capag.classificacao || null,
            arquivo_decreto_url: norma.arquivo_decreto_url || null,
            norma_autorizadora: norma.tipo || null,
            status_detalhado: cred.status_detalhado || null,
            decreto_enviado: cred.decreto_enviado ?? null,
            data_atribuicao: cred.data_atribuicao || null,
            origem_dado: 'pixconsig', ultima_sincronizacao: now, status_sync: 'ok',
            ativo: cred.status === 'ativo',
          };
          const { data: convRow, error } = await admin.from('convenios')
            .upsert(convenio, { onConflict: 'pixconsig_convenio_id' })
            .select('id').single();
          if (error) throw new Error(error.message);

          // Produtos (sem tocar taxa/prazo/valor — CONSIGTEC).
          for (const p of produtos) {
            await admin.from('produtos_convenio').upsert({
              convenio_id: convRow?.id, produto: mapProduto(p.tipo_margem),
              nome: p.nome || null, tipo_margem: mapMargem(p.tipo_margem),
              margem_percentual: numOrNull(p.percentual_margem), ativo: true,
            }, { onConflict: 'convenio_id,produto' });
          }
          res.ok++;
        } catch (e) {
          res.erros.push(`Item ${item?.id || '?'}: ${(e as Error).message}`);
        }
      }

      // Decidir próxima página tolerando várias convenções de paginação.
      if (lista.length === 0) break;
      const totPag = numOrNull(pg.total_pages ?? pg.last_page ?? pg.pages ?? pg.num_pages);
      const totItens = numOrNull(pg.total ?? pg.total_count ?? pg.count ?? (Array.isArray(json) ? null : json.total));
      if (totItens != null) totalApi = totItens;
      let flag: boolean | undefined;
      for (const k of ['has_next', 'has_more', 'hasNext', 'hasMore']) {
        if (typeof pg[k] === 'boolean') { flag = pg[k] as boolean; break; }
      }
      if (flag === undefined && (pg.next || pg.next_page || pg.next_url)) flag = true;

      let continuar: boolean;
      if (totPag != null) continuar = page < totPag;
      else if (totItens != null) continuar = res.total < totItens;
      else if (flag !== undefined) continuar = flag;
      else continuar = lista.length >= pageSize; // heurística: página cheia ⇒ provavelmente há mais
      if (!continuar) break;
      page++;
      if (page > 1000) { res.erros.push('Limite de páginas atingido (1000).'); break; }
    }
    res.total_api = totalApi;

    // Auditoria da sincronização
    await admin.from('auditoria').insert({
      entidade: 'convenios', registro_id: null, acao: 'sync_pixconsig',
      valor_novo: {
        total: res.total, ok: res.ok, ignorados: res.ignorados, paginas: res.paginas,
        total_api: res.total_api, erros: res.erros.length, erros_amostra: res.erros.slice(0, 5),
      },
    });

    return Response.json({ configurado: true, ...res });
  } catch (e) {
    return Response.json({ error: (e as Error).message, ...res }, { status: 500 });
  }
});
