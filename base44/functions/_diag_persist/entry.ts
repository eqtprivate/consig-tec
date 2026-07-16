// TEMPORÁRIO — valida migração 0090/0091 (colunas + funções). REMOVER após validar.
import { createClient } from 'npm:@supabase/supabase-js@2';
const GATE = '6948613d993f35bb74bc9b2d19d36da74366';
Deno.serve(async (req) => {
  const body = await req.json().catch(() => ({}));
  if (body.token !== GATE) return Response.json({ error: 'forbidden' }, { status: 403 });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const chk = async (fn: () => Promise<any>) => { try { const { error } = await fn(); return error ? `ERRO: ${error.message}` : 'ok'; } catch (e) { return `EXC: ${(e as Error).message}`; } };
  const rpc = async (name: string, args: any) => { try { const { data, error } = await admin.rpc(name, args); return error ? `ERRO: ${error.message}` : data; } catch (e) { return `EXC: ${(e as Error).message}`; } };

  const out: Record<string, unknown> = {};
  out.colunas = {
    clientes_rg_endereco: await chk(() => admin.from('clientes').select('rg, endereco, estado_civil, cep').limit(1)),
    ccbs_ricas_jsonb: await chk(() => admin.from('ccbs').select('cet_mensal, iof, credor_cnpj, ultimo_vencimento, dados_extraidos').limit(1)),
    config_drive: await chk(() => admin.from('config_ingestao_ccb').select('drive_folder_id, drive_ativo').limit(1)),
  };
  out.funcoes = {
    num_br_3105_70: await rpc('num_br', { p: '3.105,70' }),          // → 3105.7
    parse_data_22_05_2026: await rpc('parse_data_br', { p: '22/05/2026' }), // → 2026-05-22
    enriquecer_existe: await rpc('enriquecer_ccb_dados', { p_ccb: null, p_dados: null }), // void (null → return)
    salvar_arquivamento_existe: await rpc('salvar_arquivamento_ccb', { p_drive_folder_id: 'x', p_drive_ativo: false, p_empresa: null }), // erro de auth = existe
  };
  return Response.json(out);
});
