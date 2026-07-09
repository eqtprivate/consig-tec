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

    const { data: perfil } = await admin.from('usuarios').select('role').eq('id', caller.user.id).single();
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
        is_grupo_admin: role !== 'usuario',
        must_change_password: true, // senha definida por admin é sempre temporária
      },
      { onConflict: 'id' }
    );
    if (upsertErr) return Response.json({ error: upsertErr.message }, { status: 400 });

    // Retorna a senha temporária para o admin repassar ao usuário.
    return Response.json({ id: created.user.id, email, role, senha });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
});
