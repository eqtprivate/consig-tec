import { createClient } from 'npm:@supabase/supabase-js@2';

// Cria um novo usuário (Supabase Auth + perfil) com role e senha temporária.
// Requer os secrets SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
// A service_role NUNCA é exposta ao frontend — só é usada aqui no backend.

function gerarSenhaTemporaria(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const arr = new Uint32Array(10);
  crypto.getRandomValues(arr);
  let s = '';
  for (const n of arr) s += chars[n % chars.length];
  return 'Ct' + s + '9'; // garante letra e número, comprimento >= 8
}

function senhaForte(p: unknown): boolean {
  return typeof p === 'string' && p.length >= 8 && /[A-Za-z]/.test(p) && /[0-9]/.test(p);
}

// Envia a senha temporária por e-mail via Resend. Retorna true se enviou.
async function enviarSenhaEmail(email: string, nome: string, senha: string): Promise<boolean> {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM') || 'CONSIGTEC <no-reply@consigtec.com.br>';
  const appUrl = Deno.env.get('APP_URL') || '';
  if (!resendKey) return false;
  const linkHtml = appUrl ? `<p>Acesse: <a href="${appUrl}">${appUrl}</a></p>` : '';
  const html =
    `<p>Olá, ${nome || ''}.</p>` +
    `<p>Seu acesso ao <b>CONSIGTEC</b> foi criado. Use a senha temporária abaixo no primeiro acesso — o sistema pedirá para você definir uma senha pessoal.</p>` +
    `<p style="font-size:18px"><b>Senha temporária:</b> <code>${senha}</code></p>` +
    linkHtml +
    `<p style="color:#888">Se você não esperava este e-mail, ignore-o.</p>`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [email], subject: 'CONSIGTEC — sua senha de acesso', html }),
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
    return Response.json(
      { error: 'Configuração ausente. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nos secrets.' },
      { status: 500 }
    );
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
    if (!token) return Response.json({ error: 'Não autenticado' }, { status: 401 });

    const { data: caller, error: callerErr } = await admin.auth.getUser(token);
    if (callerErr || !caller?.user) return Response.json({ error: 'Sessão inválida' }, { status: 401 });

    const { data: perfil } = await admin.from('usuarios').select('role, empresa_id').eq('id', caller.user.id).single();
    if (!perfil || !['admin', 'superadmin'].includes(perfil.role)) {
      return Response.json({ error: 'Sem permissão para criar usuários' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { nome, email } = body;
    let role = body.role || 'usuario';
    if (!email) return Response.json({ error: 'E-mail é obrigatório' }, { status: 400 });

    // Senha: gerada automaticamente, ou informada (precisa ser forte)
    let senha: string;
    if (body.gerarSenha || !body.password) {
      senha = gerarSenhaTemporaria();
    } else {
      if (!senhaForte(body.password)) {
        return Response.json({ error: 'Senha fraca: mínimo 8 caracteres, com letra e número.' }, { status: 400 });
      }
      senha = body.password;
    }

    // Apenas superadmin pode criar admin/superadmin
    if (perfil.role !== 'superadmin' && role !== 'usuario') role = 'usuario';
    if (!['usuario', 'admin', 'superadmin'].includes(role)) role = 'usuario';

    // Tenant do novo usuário: superadmin pode indicar a empresa; admin herda a própria.
    const empresaId = (perfil.role === 'superadmin' && body.empresa_id) ? body.empresa_id : perfil.empresa_id;

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome: nome || null },
    });
    if (createErr) return Response.json({ error: createErr.message }, { status: 400 });

    const { error: upsertErr } = await admin.from('usuarios').upsert(
      {
        id: created.user.id,
        nome: nome || email.split('@')[0],
        email,
        role,
        empresa_id: empresaId || null,
        is_grupo_admin: role !== 'usuario',
        must_change_password: true, // senha definida por admin é sempre temporária
      },
      { onConflict: 'id' }
    );
    if (upsertErr) return Response.json({ error: upsertErr.message }, { status: 400 });

    // Opcionalmente envia a senha por e-mail ao próprio usuário.
    let emailEnviado = false;
    if (body.enviarEmail) {
      emailEnviado = await enviarSenhaEmail(email, nome || email.split('@')[0], senha);
    }

    // Retorna a senha temporária para o admin repassar ao usuário.
    return Response.json({ id: created.user.id, email, role, senha, emailEnviado });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
});
