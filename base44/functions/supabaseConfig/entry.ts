import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    // Endpoint público: retorna apenas as credenciais públicas do Supabase
    // A anon key é pública por design — o acesso é controlado via RLS no Postgres.
    // A service_role key NUNCA é exposta no frontend.
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      return Response.json(
        { error: "Credenciais do Supabase não configuradas. Defina SUPABASE_URL e SUPABASE_ANON_KEY nos secrets." },
        { status: 500 }
      );
    }

    return Response.json({
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});