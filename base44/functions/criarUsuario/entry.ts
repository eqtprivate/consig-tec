import { createClient } from 'npm:@supabase/supabase-js@2';

// Cria um novo usuário (Supabase Auth + perfil) com role.
// Requer os secrets SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
// A service_role NUNCA é exposta ao frontend — só é usada aqui no backend.
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Método não permitido' }, { status: 405 });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    return Response.json(
      { error: 'Configuração ausente. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nos secrets.' },
      { status: 500 }
    );
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // 1) Autentica o solicitante pelo token da sessão
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
    if (!token) return Response.json({ error: 'Não autenticado' }, { status: 401 });

    const { data: caller, error: callerErr } = await admin.auth.getUser(token);
    if (callerErr || !caller?.user) {
      return Response.json({ error: 'Sessão inválida' }, { status: 401 });
    }

    const { data: perfil } = await admin
      .from('usuarios')
      .select('role')
      .eq('id', caller.user.id)
      .single();

    if (!perfil || !['admin', 'superadmin'].includes(perfil.role)) {
      return Response.json({ error: 'Sem permissão para criar usuários' }, { status: 403 });
    }

    // 2) Valida entrada
    const body = await req.json().catch(() => ({}));
    const { nome, email, password } = body;
    let role = body.role || 'usuario';
    if (!email || !password) {
      return Response.json({ error: 'E-mail e senha são obrigatórios' }, { status: 400 });
    }
    // Apenas superadmin pode criar admin/superadmin
    if (perfil.role !== 'superadmin' && role !== 'usuario') {
      role = 'usuario';
    }
    if (!['usuario', 'admin', 'superadmin'].includes(role)) role = 'usuario';

    // 3) Cria o usuário no Auth (e-mail já confirmado)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome: nome || null },
    });
    if (createErr) {
      return Response.json({ error: createErr.message }, { status: 400 });
    }

    // 4) Garante o perfil com nome e role (o trigger cria a linha; aqui reforçamos)
    const { error: upsertErr } = await admin
      .from('usuarios')
      .upsert(
        {
          id: created.user.id,
          nome: nome || email.split('@')[0],
          email,
          role,
          is_grupo_admin: role !== 'usuario',
        },
        { onConflict: 'id' }
      );
    if (upsertErr) {
      return Response.json({ error: upsertErr.message }, { status: 400 });
    }

    return Response.json({ id: created.user.id, email, role });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
});
