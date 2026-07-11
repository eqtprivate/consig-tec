import { createClient } from 'npm:@supabase/supabase-js@2';

// Ações administrativas sobre usuários: resetar senha, ativar, desativar, excluir.
// Requer SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.

function gerarSenhaTemporaria(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const arr = new Uint32Array(10);
  crypto.getRandomValues(arr);
  let s = '';
  for (const n of arr) s += chars[n % chars.length];
  return 'Ct' + s + '9';
}

async function enviarSenhaEmail(email: string, nome: string, senha: string): Promise<boolean> {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM') || 'CONSIGTEC <no-reply@consigtec.com.br>';
  const appUrl = Deno.env.get('APP_URL') || '';
  if (!resendKey) return false;
  const linkHtml = appUrl ? `<p>Acesse: <a href="${appUrl}">${appUrl}</a></p>` : '';
  const html =
    `<p>Olá, ${nome || ''}.</p>` +
    `<p>Sua senha do <b>CONSIGTEC</b> foi redefinida. Use a senha temporária abaixo — o sistema pedirá para você criar uma nova no acesso.</p>` +
    `<p style="font-size:18px"><b>Senha temporária:</b> <code>${senha}</code></p>` +
    linkHtml +
    `<p style="color:#888">Se você não solicitou isso, fale com um administrador.</p>`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [email], subject: 'CONSIGTEC — sua senha foi redefinida', html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Método não permitido' }, { status: 405 });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    return Response.json({ error: 'Configuração ausente (SUPABASE_SERVICE_ROLE_KEY).' }, { status: 500 });
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
    if (!token) return Response.json({ error: 'Não autenticado' }, { status: 401 });

    const { data: caller, error: callerErr } = await admin.auth.getUser(token);
    if (callerErr || !caller?.user) return Response.json({ error: 'Sessão inválida' }, { status: 401 });

    const { data: perfilCaller } = await admin.from('usuarios').select('role').eq('id', caller.user.id).single();
    if (!perfilCaller || !['admin', 'superadmin'].includes(perfilCaller.role)) {
      return Response.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, usuarioId } = body;
    if (!action || !usuarioId) return Response.json({ error: 'Parâmetros inválidos' }, { status: 400 });

    // Alvo
    const { data: alvo } = await admin.from('usuarios').select('role, email, nome').eq('id', usuarioId).single();
    if (!alvo) return Response.json({ error: 'Usuário não encontrado' }, { status: 404 });

    // Admin comum não pode agir sobre admin/superadmin
    if (perfilCaller.role !== 'superadmin' && ['admin', 'superadmin'].includes(alvo.role)) {
      return Response.json({ error: 'Apenas superadmins gerenciam outros admins' }, { status: 403 });
    }
    if (usuarioId === caller.user.id && (action === 'excluir' || action === 'desativar')) {
      return Response.json({ error: 'Você não pode desativar/excluir a si mesmo' }, { status: 400 });
    }

    if (action === 'reset_senha') {
      const senha = gerarSenhaTemporaria();
      const { error } = await admin.auth.admin.updateUserById(usuarioId, { password: senha });
      if (error) return Response.json({ error: error.message }, { status: 400 });
      await admin.from('usuarios').update({ must_change_password: true }).eq('id', usuarioId);
      let emailEnviado = false;
      if (body.enviarEmail && alvo.email) {
        emailEnviado = await enviarSenhaEmail(alvo.email, alvo.nome || '', senha);
      }
      return Response.json({ ok: true, senha, emailEnviado });
    }

    if (action === 'ativar' || action === 'desativar') {
      const ativar = action === 'ativar';
      const { error } = await admin.from('usuarios').update({ ativo: ativar }).eq('id', usuarioId);
      if (error) return Response.json({ error: error.message }, { status: 400 });
      // Banir/desbanir no Auth: corta o acesso via API (não só na UI). Sem
      // isso, um usuário "inativo" com JWT válido ainda acessaria o PostgREST.
      const { error: banErr } = await admin.auth.admin.updateUserById(usuarioId, {
        ban_duration: ativar ? 'none' : '876000h',
      });
      if (banErr) return Response.json({ error: banErr.message }, { status: 400 });
      return Response.json({ ok: true });
    }

    if (action === 'excluir') {
      const { error } = await admin.auth.admin.deleteUser(usuarioId);
      if (error) return Response.json({ error: error.message }, { status: 400 });
      // O perfil em public.usuarios é removido em cascata (FK ON DELETE CASCADE).
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Ação desconhecida' }, { status: 400 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
});
