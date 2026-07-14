import { createClient } from 'npm:@supabase/supabase-js@2';

// Aprova (ou rejeita) uma ingestão de CCB conferida por um humano. Ao aprovar,
// aplica completar_venda | novo_registro (cria CCB + contrato + parcelas via a
// RPC atômica aplicar_ingestao_ccb), audita, abre pendência se houver divergência
// crítica justificada, e dispara o espelho no Drive (best-effort).
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
// (opcional) FUNCTIONS_BASE_URL para acionar espelhar_drive.

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Método não permitido' }, { status: 405 });
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !serviceKey || !anonKey) return Response.json({ error: 'Configuração ausente (service/anon key).' }, { status: 500 });

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!token) return Response.json({ error: 'Não autenticado' }, { status: 401 });
  const { data: caller } = await admin.auth.getUser(token);
  if (!caller?.user) return Response.json({ error: 'Sessão inválida' }, { status: 401 });
  const { data: perfil } = await admin.from('usuarios').select('role, empresa_id').eq('id', caller.user.id).single();
  if (!perfil || !['admin', 'superadmin'].includes(perfil.role)) return Response.json({ error: 'Sem permissão' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const ingestaoId: string = body.ingestao_id || '';
  const acao: string = body.acao || '';
  const dados = body.dados || {};
  const justificativa: string = body.justificativa || '';
  if (!ingestaoId || !acao) return Response.json({ error: 'ingestao_id e acao são obrigatórios.' }, { status: 400 });

  const { data: ing } = await admin.from('ingestoes_documento').select('*').eq('id', ingestaoId).single();
  if (!ing) return Response.json({ error: 'Ingestão não encontrada.' }, { status: 404 });
  if (perfil.role !== 'superadmin' && ing.empresa_id !== perfil.empresa_id) {
    return Response.json({ error: 'Fora do escopo da sua empresa.' }, { status: 403 });
  }

  // Rejeição / duplicata → não cria nada.
  if (acao === 'rejeitar' || acao === 'duplicata') {
    await admin.from('ingestoes_documento').update({
      status: 'rejeitado', acao_confirmada: acao === 'duplicata' ? 'duplicata' : null,
      observacao: justificativa || (acao === 'duplicata' ? 'Marcada como duplicata.' : 'Rejeitada.'),
      aprovado_por: caller.user.id, aprovado_em: new Date().toISOString(),
    }).eq('id', ingestaoId);
    await admin.from('auditoria').insert({ entidade: 'ingestoes_documento', registro_id: ingestaoId, acao: `ingestao_${acao}`, empresa_id: ing.empresa_id, valor_novo: { justificativa } });
    return Response.json({ id: ingestaoId, status: 'rejeitado' });
  }

  if (!['completar_venda', 'novo_registro'].includes(acao)) {
    return Response.json({ error: 'Ação inválida.' }, { status: 400 });
  }

  // Divergência crítica exige justificativa.
  const temCritica = Array.isArray(ing.divergencias) && ing.divergencias.some((d: any) => d?.tipo === 'critica');
  if (temCritica && !justificativa.trim()) {
    return Response.json({ error: 'Há divergência crítica — justificativa é obrigatória para aprovar.' }, { status: 400 });
  }

  // Aplica com o CONTEXTO DO USUÁRIO (auth.uid válido para a RPC e a RLS).
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: ccbId, error: rpcErr } = await userClient.rpc('aplicar_ingestao_ccb', {
    p_ingestao: ingestaoId, p_acao: acao, p_dados: dados, p_justificativa: justificativa || null, p_aprovador: caller.user.id,
  });
  if (rpcErr) return Response.json({ error: rpcErr.message }, { status: 400 });

  // Dispara o espelho no Drive — best-effort, NUNCA afeta o status da CCB.
  const base = Deno.env.get('FUNCTIONS_BASE_URL');
  if (base) {
    try {
      await fetch(`${base.replace(/\/$/, '')}/espelhar_drive`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ingestao_id: ingestaoId }),
      });
    } catch { /* ignora: o espelho tem seu próprio retry e não bloqueia */ }
  }

  return Response.json({ id: ingestaoId, status: 'aprovado', ccb_id: ccbId });
});
