import { supabase } from '@/lib/supabaseClient';
import { getEmpresaView } from '@/lib/tenantView';
import { callFn } from '@/lib/api/fnClient';

export const ingestaoApi = {
  async list(status) {
    let q = supabase.from('ingestoes_documento')
      .select('*, proposta:propostas(id, numero, cliente:clientes(nome, cpf)), ccb:ccbs(id, numero)')
      .eq('tipo_documento', 'ccb')
      .order('created_at', { ascending: false });
    if (status && status !== 'todos') q = q.eq('status', status);
    const ev = getEmpresaView(); if (ev) q = q.eq('empresa_id', ev);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  },
  async get(id) {
    const { data, error } = await supabase.from('ingestoes_documento')
      .select('*, proposta:propostas(id, numero, valor_solicitado, prazo, taxa_mensal, valor_parcela, cliente:clientes(nome, cpf))')
      .eq('id', id).single();
    if (error) throw error;
    return data;
  },
  // Envia o PDF (base64) para a Edge Function ingerir_ccb. onProgress(pct) reporta o upload.
  async ingerir(arquivoBase64, arquivoNome, onProgress) {
    const ev = getEmpresaView();
    return callFn('ingerir_ccb', { arquivo_base64: arquivoBase64, arquivo_nome: arquivoNome, ...(ev ? { empresa_id: ev } : {}) }, onProgress);
  },
  // Fase 2 da ingestão: dispara a EXTRAÇÃO na Edge Function do SUPABASE
  // (extrair_ccb) — roda com limite maior + background (waitUntil), sem o teto
  // de tempo das functions do Base44. Não aguarda a extração (o status é visto
  // por polling); a invoke retorna assim que a function responde ('extraindo').
  async processar(ingestao_id, modelo) {
    const { data, error } = await supabase.functions.invoke('extrair_ccb', {
      body: { ingestao_id, ...(modelo ? { modelo } : {}) },
    });
    if (error) throw error;
    return data;
  },
  // Relê uma ingestão existente (mesmo PDF no Storage), opcionalmente com outro
  // modelo (ex.: escalar para Opus numa CCB difícil) — também via Supabase.
  async reprocessar(ingestao_id, modelo) {
    return this.processar(ingestao_id, modelo);
  },
  async aprovar({ ingestao_id, acao, dados, justificativa }) {
    return callFn('aprovar_ingestao', { ingestao_id, acao, dados, justificativa });
  },
  // Exclui a ingestão (não aprovada) + tentativas; apaga o PDF do Storage.
  async excluir(ingestao_id) {
    const { data, error } = await supabase.rpc('excluir_ingestao', { p_id: ingestao_id });
    if (error) throw error;
    const sp = data?.storage_path;
    if (sp) { try { await supabase.storage.from('ccb-docs').remove([sp]); } catch { /* best-effort */ } }
    return data;
  },
  // URL assinada do PDF no bucket privado (para a prévia).
  async pdfUrl(storagePath) {
    if (!storagePath) return null;
    const { data, error } = await supabase.storage.from('ccb-docs').createSignedUrl(storagePath, 3600);
    if (error) return null;
    return data?.signedUrl || null;
  },
};
