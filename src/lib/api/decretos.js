import { supabase } from '@/lib/supabaseClient';
import { getEmpresaView } from '@/lib/tenantView';

// Ingestão de DECRETOS/LEIS (regras do convênio) por IA. Reusa a tabela
// ingestoes_documento (tipo_documento='decreto') e as Edge Functions
// ingerir_decreto / aprovar_decreto. A aprovação aplica as regras conferidas
// ao convênio via a RPC aplicar_regras_decreto.

async function callFn(fn, payload) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`/api/functions/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Operação falhou');
  return data;
}

export const decretosApi = {
  async list(status) {
    let q = supabase.from('ingestoes_documento')
      .select('*, convenio:convenios!convenio_id(id, nome, orgao)')
      .eq('tipo_documento', 'decreto')
      .order('created_at', { ascending: false });
    if (status && status !== 'todos') q = q.eq('status', status);
    const ev = getEmpresaView(); if (ev) q = q.eq('empresa_id', ev);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  },
  async get(id) {
    const { data, error } = await supabase.from('ingestoes_documento')
      .select('*, convenio:convenios!convenio_id(id, nome, orgao)')
      .eq('id', id).single();
    if (error) throw error;
    return data;
  },
  // Envia o PDF (base64) para a Edge Function ingerir_decreto.
  async ingerir(arquivoBase64, arquivoNome) {
    const ev = getEmpresaView();
    return callFn('ingerir_decreto', { arquivo_base64: arquivoBase64, arquivo_nome: arquivoNome, ...(ev ? { empresa_id: ev } : {}) });
  },
  async reprocessar(ingestao_id, modelo) {
    return callFn('ingerir_decreto', { reprocessar_ingestao_id: ingestao_id, ...(modelo ? { modelo } : {}) });
  },
  // acao: 'aplicar' (grava no convênio) | 'rejeitar'.
  async aprovar({ ingestao_id, acao, convenio_id, dados, justificativa }) {
    return callFn('aprovar_decreto', { ingestao_id, acao, convenio_id, dados, justificativa });
  },
  async excluir(ingestao_id) {
    const { data, error } = await supabase.rpc('excluir_ingestao', { p_id: ingestao_id });
    if (error) throw error;
    const sp = data?.storage_path;
    if (sp) { try { await supabase.storage.from('ccb-docs').remove([sp]); } catch { /* best-effort */ } }
    return data;
  },
  async pdfUrl(storagePath) {
    if (!storagePath) return null;
    const { data, error } = await supabase.storage.from('ccb-docs').createSignedUrl(storagePath, 3600);
    if (error) return null;
    return data?.signedUrl || null;
  },
};
