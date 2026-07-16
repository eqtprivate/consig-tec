import { supabase } from '@/lib/supabaseClient';
import { getEmpresaView } from '@/lib/tenantView';

// Banco de decretos lidos (ingestoes_documento tipo='decreto') para a tela
// Arquivo de Decretos: lista rica, detalhe com log de tentativas e PDF assinado.
export const decretosArquivoApi = {
  async list() {
    let q = supabase.from('ingestoes_documento')
      .select('id, arquivo_nome, storage_path, status, confianca, modelo_usado, dados_extraidos, convenio_id, tamanho_bytes, created_at, aprovado_em, convenio:convenios(id, nome, orgao)')
      .eq('tipo_documento', 'decreto')
      .order('created_at', { ascending: false });
    const ev = getEmpresaView(); if (ev) q = q.eq('empresa_id', ev);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },
  async detalhe(id) {
    const { data: ing, error } = await supabase.from('ingestoes_documento')
      .select('*, convenio:convenios(id, nome, orgao)')
      .eq('id', id).single();
    if (error) throw error;
    let pdfUrl = null;
    if (ing.storage_path) {
      const { data: s } = await supabase.storage.from('ccb-docs').createSignedUrl(ing.storage_path, 3600);
      pdfUrl = s?.signedUrl || null;
    }
    const { data: tentativas } = await supabase.from('ingestao_tentativas')
      .select('*').eq('ingestao_id', id).order('created_at', { ascending: false });
    return { ing, pdfUrl, tentativas: tentativas || [] };
  },
};
