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
  const res = { total: 0, ok: 0, ignorados: 0, paginas: 0, erros: [] as string[], total_api: null as number | null, novidades: 0, novas: 0, diag: null as unknown };

  try {
    // Paginação KEYSET por cursor (PixConsig v2.0.124+): imune a updated_at
    // repetidos. 1ª chamada sem cursor; depois ecoa pagination.next_cursor até
    // has_next=false. Mantém fallback offset (?page=) caso a API não devolva
    // next_cursor. NUNCA usamos updated_since (sync é full).
    const headers = { 'x-api-key': apiKey, Accept: 'application/json' };
    const baseConv = `${baseUrl.replace(/\/$/, '')}/convenios`;
    const pageSize = 200;
    let cursor: string | null = null;
    let page = 1;                 // usado só no fallback offset
    let forcarOffset = false;     // liga se o keyset vier vazio
    let totalApi: number | null = null;
    let guard = 0;

    // Descobre o total informado pela API (offset expõe pagination.total; o
    // keyset pode omitir). Chamada leve, só para a reconciliação de volume.
    try {
      const pr = await fetch(`${baseConv}?page=1&page_size=1`, { headers });
      if (pr.ok) { const pj = await pr.json(); totalApi = numOrNull(pj?.pagination?.total ?? pj?.total); }
    } catch { /* opcional — não bloqueia o sync */ }

    // Progresso ao vivo (barra do painel). Escrita best-effort: nunca quebra o sync.
    const prog = async (patch: Record<string, unknown>) => {
      try {
        await admin.from('sync_progresso').upsert(
          { chave: 'pixconsig', ...patch, atualizado_em: new Date().toISOString() },
          { onConflict: 'chave' },
        );
      } catch { /* tabela pode não existir ainda (migração 0050) */ }
    };
    await prog({ total: totalApi, processados: 0, pagina: 0, rodando: true, mensagem: 'iniciando', iniciado_em: now });

    // Preload em memória — evita SELECTs por item (o grande gargalo de latência).
    const entByCnpj = new Map<string, string>();
    const entByNome = new Map<string, string>(); // chave: nome|cidade|uf
    {
      const { data } = await admin.from('entidades_cadastro').select('id, cnpj, nome, cidade, uf');
      for (const e of data || []) {
        if (e.cnpj) entByCnpj.set(e.cnpj, e.id);
        entByNome.set(`${e.nome}|${e.cidade || ''}|${e.uf || ''}`, e.id);
      }
    }
    const convByPix = new Map<string, { status_detalhado: string | null; decreto_enviado: boolean | null; capag: string | null; ativo: boolean | null }>();
    {
      const { data } = await admin.from('convenios')
        .select('pixconsig_convenio_id, status_detalhado, decreto_enviado, capag, ativo')
        .eq('origem_dado', 'pixconsig');
      for (const c of data || []) if (c.pixconsig_convenio_id) convByPix.set(c.pixconsig_convenio_id, c);
    }
    const baselineVazio = convByPix.size === 0; // 1ª carga: não gera avisos de "nova prefeitura"

    for (;;) {
      guard++;
      if (guard > 1000) { res.erros.push('Limite de páginas atingido (1000).'); break; }
      const qs = new URLSearchParams({ page_size: String(pageSize) });
      if (cursor) qs.set('cursor', cursor);
      else if (forcarOffset || page > 1) qs.set('page', String(page));
      const endpoint = `${baseConv}?${qs.toString()}`;
      // busca a página com até 2 retentativas (um blip HTTP não corta a paginação)
      let r: Response | null = null;
      for (let tent = 0; tent < 3; tent++) {
        r = await fetch(endpoint, { headers });
        if (r.ok) break;
        if (tent < 2) await new Promise((s) => setTimeout(s, 500 * (tent + 1)));
      }
      if (!r || !r.ok) {
        let corpo = '';
        try { corpo = (await r?.text() || '').slice(0, 300); } catch { /* ignora */ }
        res.erros.push(`HTTP ${r?.status ?? '?'} (página ${guard}): ${corpo}`);
        if (guard === 1) res.diag = { erro_http: r?.status ?? null, corpo, endpoint };
        break;
      }
      const json = await r.json();
      const lista = Array.isArray(json) ? json : (json?.data || json?.items || json?.results || json?.convenios || []);
      const pg = ((!Array.isArray(json) && (json.pagination || json.meta || json)) || {}) as Record<string, unknown>;
      if (numOrNull(pg.total) != null) totalApi = numOrNull(pg.total);
      // Diagnóstico da 1ª página: registra o formato real da resposta.
      if (guard === 1) {
        res.diag = Array.isArray(json)
          ? { formato: 'array', itens_pagina: lista.length }
          : { modo: pg.mode ?? null, tem_next_cursor: typeof pg.next_cursor === 'string', has_next: pg.has_next ?? null, itens_pagina: lista.length, chaves: Object.keys(json) };
      }
      res.paginas++;

      // ===== Processamento da página EM LOTE (evita ~6 round-trips por item) =====
      const procItens: any[] = [];
      const novasEnt = new Map<string, Record<string, unknown>>(); // dedupKey -> payload (sem id)
      const updEnt = new Map<string, Record<string, unknown>>();    // id -> payload (com id)

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
          const entKey = `${nome}|${cidade || ''}|${uf || ''}`;

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

          // resolve entidade existente (memória) ou agenda criação em lote
          const existente = (cnpj && entByCnpj.get(cnpj)) || entByNome.get(entKey) || null;
          if (existente) updEnt.set(existente, { id: existente, ...entPayload });
          else {
            const dk = cnpj ? `c:${cnpj}` : `n:${entKey}`;
            if (!novasEnt.has(dk)) novasEnt.set(dk, entPayload);
          }

          const pctApartada = numOrNull(margens.decreto_cartao) ?? numOrNull(primary.percentual_margem);
          const convenio: Record<string, unknown> = {
            pixconsig_convenio_id: item.id,
            nome, orgao: cidade, tipo: 'publico', entidade_id: null,
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
          procItens.push({ id: item.id, nome, uf, cnpj, entKey, convenio, produtos, capagCls: capag.classificacao || null, cred });
        } catch (e) {
          res.erros.push(`Item ${item?.id || '?'}: ${(e as Error).message}`);
        }
      }

      try {
        // 1) cria entidades novas em lote e mapeia as chaves para os novos ids
        if (novasEnt.size) {
          const { data, error } = await admin.from('entidades_cadastro')
            .insert([...novasEnt.values()]).select('id, cnpj, nome, cidade, uf');
          if (error) throw new Error(`entidades(new): ${error.message}`);
          for (const e of data || []) {
            if (e.cnpj) entByCnpj.set(e.cnpj, e.id);
            entByNome.set(`${e.nome}|${e.cidade || ''}|${e.uf || ''}`, e.id);
          }
        }
        // 2) atualiza entidades existentes em lote (upsert por id)
        if (updEnt.size) {
          const { error } = await admin.from('entidades_cadastro')
            .upsert([...updEnt.values()], { onConflict: 'id' });
          if (error) throw new Error(`entidades(upd): ${error.message}`);
        }
        // 3) resolve entidade_id e faz upsert dos convênios em lote
        const convByKey = new Map<string, Record<string, unknown>>();
        for (const it of procItens) {
          const eid = (it.cnpj && entByCnpj.get(it.cnpj)) || entByNome.get(it.entKey) || null;
          it.entidadeId = eid;
          convByKey.set(it.id, { ...it.convenio, entidade_id: eid }); // dedup por pixconsig id
        }
        let convIdByPix = new Map<string, string>();
        const convRows = [...convByKey.values()];
        if (convRows.length) {
          const { data, error } = await admin.from('convenios')
            .upsert(convRows, { onConflict: 'pixconsig_convenio_id' }).select('id, pixconsig_convenio_id');
          if (error) throw new Error(`convenios: ${error.message}`);
          convIdByPix = new Map((data || []).map((c: any) => [c.pixconsig_convenio_id, c.id]));
          res.ok += convRows.length;
        }
        // 4) produtos + novidades em lote
        const prodByKey = new Map<string, Record<string, unknown>>();
        const eventRows: Record<string, unknown>[] = [];
        for (const it of procItens) {
          const convId = convIdByPix.get(it.id);
          if (!convId) continue;
          for (const p of it.produtos) {
            const prod = mapProduto(p.tipo_margem);
            prodByKey.set(`${convId}|${prod}`, {
              convenio_id: convId, produto: prod, nome: p.nome || null,
              tipo_margem: mapMargem(p.tipo_margem), margem_percentual: numOrNull(p.percentual_margem), ativo: true,
            });
          }
          // Novidades vs estado ORIGINAL (convByPix, pré-sync).
          const antigo = convByPix.get(it.id);
          const label = `${it.nome}${it.uf ? '/' + it.uf : ''}`;
          const st = it.cred.status_detalhado || null;
          const ev = (evento: string, mensagem: string, payload?: unknown) =>
            eventRows.push({ origem: 'pixconsig', evento, convenio_id: convId, entidade_id: it.entidadeId, status: 'novidade', mensagem, payload: payload ?? null, created_at: now });
          if (!antigo) {
            res.novas++;
            if (!baselineVazio) ev('nova_prefeitura', `Nova prefeitura: ${label}`);
          } else {
            if ((antigo.status_detalhado || null) !== st) ev('mudanca_status', `${label}: status ${antigo.status_detalhado || '—'} → ${st || '—'}`, { de: antigo.status_detalhado, para: st });
            if (antigo.ativo !== (it.cred.status === 'ativo') && it.cred.status === 'ativo') ev('ativada', `${label}: convênio ATIVADO`);
            if (antigo.decreto_enviado !== true && it.cred.decreto_enviado === true) ev('decreto_enviado', `${label}: decreto enviado`);
            if ((antigo.capag || null) !== it.capagCls && it.capagCls) ev('mudanca_capag', `${label}: CAPAG ${antigo.capag || '—'} → ${it.capagCls}`, { de: antigo.capag, para: it.capagCls });
          }
        }
        if (prodByKey.size) {
          const { error } = await admin.from('produtos_convenio').upsert([...prodByKey.values()], { onConflict: 'convenio_id,produto' });
          if (error) res.erros.push(`produtos: ${error.message}`);
        }
        if (eventRows.length) {
          const { error } = await admin.from('sincronizacoes_convenio').insert(eventRows);
          if (!error) res.novidades += eventRows.length;
        }
      } catch (e) {
        res.erros.push(`Página ${guard}: ${(e as Error).message}`);
      }

      // Progresso ao vivo após cada página.
      await prog({ total: totalApi, processados: res.total, pagina: res.paginas, rodando: true, mensagem: 'sincronizando' });

      // Próxima página: keyset (cursor) primeiro; senão fallback offset.
      if (lista.length === 0) {
        // Keyset veio vazio na 1ª página mas há dados → tenta modo offset do zero.
        if (!forcarOffset && !cursor && (totalApi ?? 0) > 0) {
          forcarOffset = true; page = 1;
          res.erros.push('1ª página keyset vazia — fallback para offset');
          continue;
        }
        break;
      }
      const nextCursor = (typeof pg.next_cursor === 'string' && pg.next_cursor) ? pg.next_cursor : null;
      if (nextCursor) {
        if (pg.has_next === false) break;   // última página do keyset
        cursor = nextCursor;
      } else {
        // Fallback offset (API não devolveu next_cursor).
        const totPag = numOrNull(pg.total_pages ?? pg.last_page ?? pg.pages);
        const hasMore = pg.has_next === true
          || (totPag != null ? page < totPag : (totalApi != null ? res.total < totalApi : lista.length >= pageSize));
        if (!hasMore) break;
        page++;
      }
    }
    res.total_api = totalApi;
    await prog({ total: totalApi, processados: res.total, pagina: res.paginas, rodando: false,
                 mensagem: res.erros.length ? `concluído com ${res.erros.length} erro(s)` : 'concluído' });

    // Auditoria da sincronização
    await admin.from('auditoria').insert({
      entidade: 'convenios', registro_id: null, acao: 'sync_pixconsig',
      valor_novo: {
        total: res.total, ok: res.ok, ignorados: res.ignorados, paginas: res.paginas,
        total_api: res.total_api, novidades: res.novidades, novas: res.novas,
        erros: res.erros.length, erros_amostra: res.erros.slice(0, 5),
      },
    });

    return Response.json({ configurado: true, ...res });
  } catch (e) {
    try {
      await admin.from('sync_progresso').upsert(
        { chave: 'pixconsig', rodando: false, mensagem: `erro: ${(e as Error).message}`, atualizado_em: new Date().toISOString() },
        { onConflict: 'chave' },
      );
    } catch { /* best-effort */ }
    return Response.json({ error: (e as Error).message, ...res }, { status: 500 });
  }
});
