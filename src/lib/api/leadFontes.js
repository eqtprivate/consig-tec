import { supabase } from '@/lib/supabaseClient';
import { getEmpresaView } from '@/lib/tenantView';
import { callFn } from '@/lib/api/fnClient';

// Originação de leads por convênio (migr. 0099). Uma FONTE é uma planilha enviada
// (upload) ou um link (url_template/endpoint_api/rpa) com um de-para de colunas.
// A consolidação concatena as fontes ativas, deduplica (CPF → nome → matrícula →
// órgão/cidade) e gera/atualiza `leads`. Bucket privado: 'lead-fontes'.
const BUCKET = 'lead-fontes';

export const leadFontesApi = {
  // Fontes cadastradas de um convênio.
  async listFontes(convenioId) {
    let q = supabase.from('lead_fontes').select('*')
      .eq('convenio_id', convenioId).order('created_at', { ascending: false });
    const ev = getEmpresaView(); if (ev) q = q.eq('empresa_id', ev);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  // Sobe uma planilha ao Storage privado; devolve o caminho para gravar na fonte.
  async uploadPlanilha({ empresaId, convenioId, file }) {
    const safe = String(file?.name || 'planilha').replace(/[^\w.\-]+/g, '_');
    const path = `${empresaId}/${convenioId}/${crypto.randomUUID()}_${safe}`;
    const { error } = await supabase.storage.from(BUCKET)
      .upload(path, file, { contentType: file?.type || 'application/octet-stream', upsert: false });
    if (error) throw error;
    return { path, nome: file?.name || safe };
  },

  async createFonte(payload) {
    const { data, error } = await supabase.from('lead_fontes').insert(payload).select().single();
    if (error) throw error;
    return data;
  },

  async updateFonte(id, updates) {
    const { data, error } = await supabase.from('lead_fontes').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // Remove a fonte e, se for upload, apaga o arquivo do Storage (best-effort).
  async removeFonte(id) {
    const { data: f } = await supabase.from('lead_fontes').select('arquivo_storage_path').eq('id', id).maybeSingle();
    const { error } = await supabase.from('lead_fontes').delete().eq('id', id);
    if (error) throw error;
    if (f?.arquivo_storage_path) { try { await supabase.storage.from(BUCKET).remove([f.arquivo_storage_path]); } catch { /* best-effort */ } }
  },

  // URL assinada para baixar/prever a planilha enviada.
  async arquivoUrl(path) {
    if (!path) return null;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error) return null;
    return data?.signedUrl || null;
  },

  // Rodadas de consolidação do convênio (histórico + contadores).
  async listConsolidacoes(convenioId) {
    let q = supabase.from('lead_consolidacoes').select('*')
      .eq('convenio_id', convenioId).order('created_at', { ascending: false });
    const ev = getEmpresaView(); if (ev) q = q.eq('empresa_id', ev);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  // Dispara a consolidação (edge function consolidar_leads): concatena fontes,
  // normaliza, deduplica e gera/atualiza leads. Inline no Base44 (a tela aguarda).
  async consolidar(convenioId, competencia) {
    const ev = getEmpresaView();
    return callFn('consolidar_leads', {
      convenio_id: convenioId,
      ...(competencia ? { competencia } : {}),
      ...(ev ? { empresa_id: ev } : {}),
    });
  },

  // Base legal (LGPD) do convênio para enriquecimento.
  async getLgpd(convenioId) {
    let q = supabase.from('enriquecimento_lgpd').select('*').eq('convenio_id', convenioId).limit(1);
    const ev = getEmpresaView(); if (ev) q = q.eq('empresa_id', ev);
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    return data || null;
  },
  async saveLgpd(payload) {
    const { data, error } = await supabase.from('enriquecimento_lgpd')
      .upsert(payload, { onConflict: 'empresa_id,convenio_id' }).select().single();
    if (error) throw error;
    return data;
  },

  // Dimensionamento da base capturada (agrega lead_staging por convênio).
  async dimensionamento(convenioId, competencia) {
    const { data, error } = await supabase.rpc('dimensionamento_folha', { p_convenio: convenioId, p_competencia: competencia || null });
    if (error) throw error;
    return data || null;
  },
};

// papéis e tipos válidos (espelham os CHECKs da migração 0099).
export const PAPEIS_FONTE = [
  { v: 'folha_remuneracao', label: 'Folha — remuneração' },
  { v: 'folha_vinculo', label: 'Folha — vínculo' },
  { v: 'folha_funcional', label: 'Folha — funcional' },
  { v: 'folha_cargo', label: 'Folha — por cargo' },
  { v: 'folha_orgao', label: 'Folha — por órgão' },
  { v: 'contatos', label: 'Contatos (telefone/e-mail)' },
  { v: 'decreto', label: 'Decreto' },
  { v: 'outro', label: 'Outro' },
];
export const MODOS_FONTE = [
  { v: 'origem', label: 'Gera leads (origem)' },
  { v: 'enriquecimento', label: 'Só enriquece (atualiza existentes)' },
];
export const TIPOS_FONTE = [
  { v: 'upload', label: 'Planilha (upload)' },
  { v: 'url_template', label: 'Link (URL de exportação)' },
  { v: 'endpoint_api', label: 'Endpoint (API do portal)' },
  { v: 'rpa', label: 'Robô (RPA)' },
];

// Campos canônicos que o de-para pode alimentar (coluna_origem -> campo).
export const CAMPOS_CANONICOS = [
  'cpf', 'nome', 'matricula', 'orgao', 'cidade', 'uf',
  'cargo', 'unidade', 'vinculo',
  'remuneracao_bruta', 'descontos_obrigatorios', 'remuneracao_liquida',
  'telefone', 'email', 'whatsapp',
];
