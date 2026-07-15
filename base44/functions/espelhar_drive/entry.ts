import { createClient } from 'npm:@supabase/supabase-js@2';

// Espelha o PDF da CCB no Google Drive (pasta privada por empresa/ano). Usa uma
// service account (credenciais em GOOGLE_SA_JSON — secret/Vault). Best-effort com
// retry: falha NUNCA afeta a CCB nem a ingestão (apenas não grava drive_file_id).
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_SA_JSON,
// GOOGLE_DRIVE_ROOT_FOLDER_ID.

function pemToPkcs8(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s+/g, '');
  const bin = atob(b64); const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const strB64url = (s: string) => b64url(new TextEncoder().encode(s));

async function googleToken(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = strB64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = strB64url(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const key = await crypto.subtle.importKey('pkcs8', pemToPkcs8(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claim}`)));
  const jwt = `${header}.${claim}.${b64url(sig)}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error(`token ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).access_token;
}

async function ensureFolder(tok: string, name: string, parent: string): Promise<string> {
  const q = encodeURIComponent(`name='${name.replace(/'/g, "\\'")}' and '${parent}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, { headers: { Authorization: `Bearer ${tok}` } });
  const j = await r.json();
  if (j.files?.[0]) return j.files[0].id;
  const c = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parent] }),
  });
  return (await c.json()).id;
}

async function uploadPdf(tok: string, nome: string, parent: string, bytes: Uint8Array): Promise<string> {
  const boundary = 'consigtec' + Math.floor(Date.now()).toString(36);
  const meta = JSON.stringify({ name: nome, parents: [parent] });
  const enc = new TextEncoder();
  const pre = enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`);
  const post = enc.encode(`\r\n--${boundary}--`);
  const bodyArr = new Uint8Array(pre.length + bytes.length + post.length);
  bodyArr.set(pre, 0); bodyArr.set(bytes, pre.length); bodyArr.set(post, pre.length + bytes.length);
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body: bodyArr,
  });
  if (!r.ok) throw new Error(`upload ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).id;
}

// Espelha UMA ingestão. Retorna { mirrored, ... }. Nunca lança.
async function espelharIngestao(admin: any, ing: any, saRaw: string, globalRoot: string | null) {
  if (!ing.storage_path) return { id: ing.id, mirrored: false, motivo: 'sem storage_path' };
  // Destino: pasta do Drive DA EMPRESA (se registrada/ativa) ou a pasta global.
  let empFolder: string | null = null;
  try {
    const { data: cfg } = await admin.from('config_ingestao_ccb').select('drive_folder_id, drive_ativo').eq('empresa_id', ing.empresa_id).maybeSingle();
    if (cfg?.drive_ativo && cfg?.drive_folder_id) empFolder = String(cfg.drive_folder_id).trim();
  } catch { /* colunas podem não existir antes da 0091 */ }
  const root = empFolder || globalRoot;
  if (!root) return { id: ing.id, mirrored: false, motivo: 'sem pasta de Drive (global ou por empresa)' };
  const { data: file, error: dlErr } = await admin.storage.from('ccb-docs').download(ing.storage_path);
  if (dlErr || !file) return { id: ing.id, mirrored: false, motivo: 'PDF não encontrado no Storage.' };
  const bytes = new Uint8Array(await file.arrayBuffer());

  const dados = ing.dados_extraidos || {};
  const numero = (dados.numero_ccb || ing.id.slice(0, 8)).toString().replace(/\W+/g, '');
  const cpf = (dados.cpf || '').toString().replace(/\D/g, '');
  const dataStr = new Date().toISOString().slice(0, 10);
  const nome = `CCB_${numero}_${cpf}_${dataStr}.pdf`;
  const ano = new Date().getFullYear().toString();
  const empNome = (ing.empresa?.nome || ing.empresa_id).toString().replace(/[\\/:*?"<>|]/g, '_');

  let lastErr = '';
  for (let tent = 0; tent < 3; tent++) {
    try {
      const sa = JSON.parse(saRaw);
      const tok = await googleToken(sa);
      // Pasta própria da empresa → organiza por ano; pasta global → empresa/ano.
      const parent = empFolder
        ? await ensureFolder(tok, ano, empFolder)
        : await ensureFolder(tok, ano, await ensureFolder(tok, empNome, root));
      const fileId = await uploadPdf(tok, nome, parent, bytes);
      await admin.from('ingestoes_documento').update({ drive_file_id: fileId, drive_sincronizado_em: new Date().toISOString() }).eq('id', ing.id);
      return { id: ing.id, mirrored: true, drive_file_id: fileId, nome };
    } catch (e) {
      lastErr = (e as Error).message;
      await new Promise((s) => setTimeout(s, 600 * (tent + 1)));
    }
  }
  return { id: ing.id, mirrored: false, erro: lastErr };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Método não permitido' }, { status: 405 });
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return Response.json({ error: 'Configuração ausente.' }, { status: 500 });
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const body = await req.json().catch(() => ({}));

  // Autorização: token do cron (header) OU sessão de admin/superadmin.
  const syncToken = Deno.env.get('INGESTAO_SYNC_TOKEN');
  const hdrToken = req.headers.get('x-sync-token');
  let autorizado = !!(syncToken && hdrToken && hdrToken === syncToken);
  if (!autorizado) {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
    if (!token) return Response.json({ error: 'Não autenticado' }, { status: 401 });
    const { data: caller } = await admin.auth.getUser(token);
    if (!caller?.user) return Response.json({ error: 'Sessão inválida' }, { status: 401 });
    const { data: perfil } = await admin.from('usuarios').select('role').eq('id', caller.user.id).single();
    if (!perfil || !['admin', 'superadmin'].includes(perfil.role)) return Response.json({ error: 'Sem permissão' }, { status: 403 });
    autorizado = true;
  }

  const saRaw = Deno.env.get('GOOGLE_SA_JSON');
  const globalRoot = Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID') || null;
  if (!saRaw) return Response.json({ mirrored: false, motivo: 'Google Drive não configurado (GOOGLE_SA_JSON ausente).' });

  // Modo RETRY em lote (cron): reprocessa ingestões aprovadas sem drive_file_id.
  if (body.reprocessar) {
    const { data: pend } = await admin.from('ingestoes_documento')
      .select('*, empresa:empresas(nome)')
      .eq('status', 'aprovado').is('drive_file_id', null).not('storage_path', 'is', null)
      .order('aprovado_em', { ascending: true }).limit(25);
    const resultados = [];
    for (const ing of pend || []) resultados.push(await espelharIngestao(admin, ing, saRaw, globalRoot));
    return Response.json({ reprocessados: resultados.length, ok: resultados.filter((r) => r.mirrored).length, resultados });
  }

  // Modo unitário (chamado pelo aprovar_ingestao).
  const ingestaoId: string = body.ingestao_id || '';
  if (!ingestaoId) return Response.json({ error: 'ingestao_id obrigatório.' }, { status: 400 });
  const { data: ing } = await admin.from('ingestoes_documento').select('*, empresa:empresas(nome)').eq('id', ingestaoId).single();
  if (!ing) return Response.json({ error: 'Ingestão não encontrada.' }, { status: 404 });
  if (ing.drive_file_id) return Response.json({ mirrored: true, drive_file_id: ing.drive_file_id, already: true });
  return Response.json(await espelharIngestao(admin, ing, saRaw, globalRoot));
});
