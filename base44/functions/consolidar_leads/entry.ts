import { createClient } from 'npm:@supabase/supabase-js@2';

// consolidar_leads — Originação de leads por convênio (migr. 0099).
// Lê as fontes ativas do convênio (planilha no Storage 'lead-fontes' OU link),
// parseia (CSV/JSON/XLSX), aplica o de-para → campos canônicos, grava em
// lead_staging, deduplica (CPF → nome → matrícula → órgão/cidade) e gera/atualiza
// `leads` (atribuídos a uma franquia da empresa, para ficarem visíveis ao tenant).
// Retorno inline (a tela aguarda). Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

const BUCKET = 'lead-fontes';
const CAMPOS = new Set([
  'cpf', 'nome', 'matricula', 'orgao', 'cidade', 'uf', 'cargo', 'unidade', 'vinculo',
  'remuneracao_bruta', 'descontos_obrigatorios', 'remuneracao_liquida',
  'telefone', 'email', 'whatsapp',
]);
const NUMERICOS = new Set(['remuneracao_bruta', 'descontos_obrigatorios', 'remuneracao_liquida']);

const soDig = (v: unknown) => (v == null ? '' : String(v).replace(/\D/g, ''));
const S = (v: unknown) => { const s = v == null ? '' : String(v).trim(); return s === '' ? null : s; };
// Número BR: "1.234,56" → 1234.56 ; "1234.56" → 1234.56.
function numBR(v: unknown): number | null {
  if (v == null || v === '') return null;
  let s = String(v).replace(/[R$\s]/g, '');
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

// CSV com aspas (RFC-ish). Retorna matriz de linhas.
function parseCSV(texto: string, sep = ','): string[][] {
  const linhas: string[][] = [];
  let campo = '', linha: string[] = [], aspas = false;
  const t = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else aspas = false; }
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ''; }
    else if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else campo += c;
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.filter((l) => l.some((x) => x !== ''));
}

// Converte uma matriz [cabeçalho, ...linhas] em objetos {coluna: valor}.
function matrizParaObjs(m: string[][]): Record<string, string>[] {
  if (!m.length) return [];
  const head = m[0].map((h) => h.trim());
  return m.slice(1).map((l) => {
    const o: Record<string, string> = {};
    head.forEach((h, i) => { o[h] = (l[i] ?? '').trim(); });
    return o;
  });
}

async function lerFonteRegistros(admin: any, fonte: any, competencia: string | null): Promise<Record<string, string>[]> {
  const formato = (fonte.formato || '').toLowerCase();
  let buf: ArrayBuffer | null = null;
  let texto: string | null = null;

  if (fonte.tipo === 'upload') {
    if (!fonte.arquivo_storage_path) throw new Error('fonte upload sem arquivo');
    const { data, error } = await admin.storage.from(BUCKET).download(fonte.arquivo_storage_path);
    if (error || !data) throw new Error('arquivo não encontrado no Storage');
    buf = await data.arrayBuffer();
  } else {
    // Link: url_template com coringas {ano} {mes} {competencia}
    const comp = competencia || '';
    const [ano, mes] = comp.includes('-') ? comp.split('-') : ['', ''];
    const url = String(fonte.url_template || '')
      .replaceAll('{ano}', ano).replaceAll('{mes}', mes).replaceAll('{competencia}', comp);
    if (!url) throw new Error('fonte sem URL');
    const res = await fetch(url, { method: fonte.metodo || 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status} ao baixar a fonte`);
    buf = await res.arrayBuffer();
  }

  if (formato === 'json') {
    texto = new TextDecoder(fonte.encoding || 'utf-8').decode(buf!);
    const j = JSON.parse(texto);
    const arr = Array.isArray(j) ? j : (Array.isArray(j?.data) ? j.data : (Array.isArray(j?.registros) ? j.registros : []));
    return arr.map((o: any) => { const r: Record<string, string> = {}; for (const k in o) r[k] = o[k] == null ? '' : String(o[k]); return r; });
  }
  if (formato === 'xlsx' || formato === 'xls') {
    const XLSX = await import('npm:xlsx@0.18.5');
    const wb = XLSX.read(new Uint8Array(buf!), { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) as any[][];
    return matrizParaObjs(rows.map((r) => r.map((c) => String(c ?? ''))));
  }
  // default: CSV/TSV
  texto = new TextDecoder(fonte.encoding || 'utf-8').decode(buf!);
  const sep = fonte.separador || (formato === 'tsv' ? '\t' : ',');
  return matrizParaObjs(parseCSV(texto, sep));
}

// Aplica o de-para (coluna_origem -> campo_canonico) a um registro cru.
function normalizar(reg: Record<string, string>, dePara: Record<string, string>) {
  const out: Record<string, any> = {};
  for (const [col, campo] of Object.entries(dePara || {})) {
    if (!CAMPOS.has(campo)) continue;
    const val = reg[col];
    if (val == null || val === '') continue;
    out[campo] = NUMERICOS.has(campo) ? numBR(val) : (campo === 'cpf' ? soDig(val) : S(val));
  }
  return out;
}

// Chave de dedup em cascata: CPF → nome → matrícula → órgão/cidade.
function chaveDedup(r: Record<string, any>): string | null {
  const cpf = soDig(r.cpf);
  if (cpf.length >= 11) return 'cpf:' + cpf.slice(0, 11);
  const nome = S(r.nome);
  if (!nome) return null;
  const norm = (s: any) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const disc = S(r.matricula) || S(r.orgao) || S(r.cidade) || '';
  return 'nm:' + norm(nome) + '|' + norm(disc);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Método não permitido' }, { status: 405 });
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return Response.json({ error: 'Configuração ausente (service role).' }, { status: 500 });
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!token) return Response.json({ error: 'Não autenticado' }, { status: 401 });
  const { data: caller } = await admin.auth.getUser(token);
  if (!caller?.user) return Response.json({ error: 'Sessão inválida' }, { status: 401 });
  const { data: perfil } = await admin.from('usuarios').select('role, empresa_id').eq('id', caller.user.id).single();
  if (!perfil || !['admin', 'superadmin'].includes(perfil.role)) return Response.json({ error: 'Sem permissão' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const convenioId = body.convenio_id;
  const competencia = S(body.competencia);
  if (!convenioId) return Response.json({ error: 'convenio_id é obrigatório.' }, { status: 400 });
  const empresaId = (perfil.role === 'superadmin' && body.empresa_id) ? body.empresa_id : perfil.empresa_id;
  if (!empresaId) return Response.json({ error: 'Empresa não identificada.' }, { status: 400 });

  // Fontes ativas do convênio (exceto decreto — não vira lead).
  const { data: fontes, error: fErr } = await admin.from('lead_fontes')
    .select('*').eq('convenio_id', convenioId).eq('empresa_id', empresaId).eq('ativo', true).neq('papel', 'decreto');
  if (fErr) return Response.json({ error: fErr.message }, { status: 400 });
  if (!fontes || !fontes.length) return Response.json({ error: 'Nenhuma fonte ativa para consolidar.' }, { status: 400 });

  // Abre a consolidação.
  const { data: cons, error: cErr } = await admin.from('lead_consolidacoes').insert({
    empresa_id: empresaId, convenio_id: convenioId, competencia, status: 'processando', iniciada_at: new Date().toISOString(),
  }).select().single();
  if (cErr) return Response.json({ error: cErr.message }, { status: 400 });

  try {
    // 1) Lê + normaliza cada fonte → linhas de staging.
    const linhasStaging: Record<string, any>[] = [];
    let totalLinhas = 0;
    for (const f of fontes) {
      try {
        const regs = await lerFonteRegistros(admin, f, competencia);
        let n = 0;
        for (const reg of regs) {
          const norm = normalizar(reg, f.de_para || {});
          if (!S(norm.nome) && !soDig(norm.cpf)) continue; // sem identidade mínima → ignora
          norm.chave_dedup = chaveDedup(norm);
          linhasStaging.push({
            empresa_id: empresaId, convenio_id: convenioId, consolidacao_id: cons.id, fonte_id: f.id,
            competencia, ...norm,
          });
          n++;
        }
        totalLinhas += n;
        await admin.from('lead_fontes').update({ ultimo_status: `ok: ${n} linhas`, ultimo_ok_at: new Date().toISOString(), linhas: n }).eq('id', f.id);
      } catch (e) {
        await admin.from('lead_fontes').update({ ultimo_status: 'erro: ' + (e as Error).message }).eq('id', f.id);
      }
    }

    // Grava staging em lotes.
    for (let i = 0; i < linhasStaging.length; i += 500) {
      const lote = linhasStaging.slice(i, i + 500);
      if (lote.length) await admin.from('lead_staging').insert(lote);
    }

    // 2) Deduplica por chave, mesclando contato/remuneração.
    const porChave = new Map<string, Record<string, any>>();
    let semChave = 0;
    for (const r of linhasStaging) {
      const k = r.chave_dedup;
      if (!k) { semChave++; continue; }
      const cur = porChave.get(k);
      if (!cur) porChave.set(k, { ...r });
      else for (const campo of CAMPOS) if ((cur[campo] == null || cur[campo] === '') && r[campo] != null && r[campo] !== '') cur[campo] = r[campo];
    }
    const unicos = [...porChave.values()];

    // 3) Franquia da empresa (para o lead ficar visível ao tenant).
    const { data: fr } = await admin.from('franquias').select('id').eq('empresa_id', empresaId).order('created_at').limit(1).maybeSingle();
    const franquiaId = fr?.id || null;

    // 4) Gera/atualiza leads (match por convênio + CPF, senão convênio + nome).
    let gerados = 0;
    for (const r of unicos) {
      const cpf = soDig(r.cpf);
      const nome = S(r.nome) || (cpf ? `CPF ${cpf}` : null);
      if (!nome) continue;
      let q = admin.from('leads').select('id, telefone, email').eq('convenio_id', convenioId).limit(1);
      q = cpf ? q.eq('cpf', cpf) : q.eq('nome', nome);
      const { data: existente } = await q.maybeSingle();
      const contato = { telefone: S(r.telefone) || S(r.whatsapp), email: S(r.email) };
      if (existente) {
        const upd: Record<string, any> = {};
        if (!existente.telefone && contato.telefone) upd.telefone = contato.telefone;
        if (!existente.email && contato.email) upd.email = contato.email;
        if (Object.keys(upd).length) await admin.from('leads').update(upd).eq('id', existente.id);
      } else {
        await admin.from('leads').insert({
          nome, cpf: cpf || null, telefone: contato.telefone, email: contato.email,
          origem: 'originacao', convenio_id: convenioId, franquia_id: franquiaId,
          valor_estimado: numBR(r.remuneracao_liquida) ?? numBR(r.remuneracao_bruta),
          observacao: r.cargo ? `Cargo: ${r.cargo}${r.orgao ? ` · ${r.orgao}` : ''}` : null,
        });
        gerados++;
      }
    }

    await admin.from('lead_consolidacoes').update({
      status: 'concluida', total_linhas: totalLinhas, total_unicos: unicos.length, total_leads: gerados,
      observacao: semChave ? `${semChave} linha(s) sem identidade p/ dedup` : null,
      concluida_at: new Date().toISOString(),
    }).eq('id', cons.id);

    return Response.json({
      id: cons.id, status: 'concluida',
      total_linhas: totalLinhas, total_unicos: unicos.length, total_leads: gerados,
    });
  } catch (e) {
    await admin.from('lead_consolidacoes').update({ status: 'erro', observacao: (e as Error).message, concluida_at: new Date().toISOString() }).eq('id', cons.id);
    return Response.json({ id: cons.id, status: 'erro', error: (e as Error).message }, { status: 200 });
  }
});
