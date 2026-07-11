import { createClient } from 'npm:@supabase/supabase-js@2';

// Motor de notificação (Resend). Processa a fila `notificacoes` (status
// pendente) e envia e-mails. Gated: sem RESEND_API_KEY, retorna 'não
// configurado' sem falhar. Requer SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Somente admin/superadmin pode disparar.

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Método não permitido' }, { status: 405 });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('RESEND_FROM') || 'CONSIGTEC <no-reply@consigtec.com.br>';
  if (!url || !serviceKey) {
    return Response.json({ error: 'Configuração ausente (SUPABASE_SERVICE_ROLE_KEY).' }, { status: 500 });
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
    if (!token) return Response.json({ error: 'Não autenticado' }, { status: 401 });
    const { data: caller, error: callerErr } = await admin.auth.getUser(token);
    if (callerErr || !caller?.user) return Response.json({ error: 'Sessão inválida' }, { status: 401 });
    const { data: perfil } = await admin.from('usuarios').select('role').eq('id', caller.user.id).single();
    if (!perfil || !['admin', 'superadmin'].includes(perfil.role)) {
      return Response.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit) || 25, 100);

    // Busca pendentes (ou uma específica por id)
    let q = admin.from('notificacoes').select('*').eq('status_envio', 'pendente').limit(limit);
    if (body.id) q = admin.from('notificacoes').select('*').eq('id', body.id);
    const { data: pendentes, error: qErr } = await q;
    if (qErr) return Response.json({ error: qErr.message }, { status: 400 });

    if (!resendKey) {
      return Response.json({
        configurado: false,
        pendentes: pendentes?.length || 0,
        mensagem: 'RESEND_API_KEY não configurada. Defina o secret para habilitar o envio.',
      });
    }

    let enviados = 0, falhas = 0;
    for (const n of pendentes || []) {
      const destinatarios: string[] = Array.isArray(n.destinatarios)
        ? n.destinatarios
        : (n.destinatarios ? JSON.parse(n.destinatarios) : []);
      if (!destinatarios.length) {
        await admin.from('notificacoes').update({ status_envio: 'erro' }).eq('id', n.id);
        falhas++; continue;
      }
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: fromEmail, to: destinatarios,
            subject: n.assunto || `CONSIGTEC — ${n.evento}`,
            html: n.corpo || `<p>Evento: ${n.evento}</p>`,
          }),
        });
        if (res.ok) { await admin.from('notificacoes').update({ status_envio: 'enviado' }).eq('id', n.id); enviados++; }
        else { await admin.from('notificacoes').update({ status_envio: 'erro' }).eq('id', n.id); falhas++; }
      } catch {
        await admin.from('notificacoes').update({ status_envio: 'erro' }).eq('id', n.id); falhas++;
      }
    }

    return Response.json({ configurado: true, processados: (pendentes?.length || 0), enviados, falhas });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
});
