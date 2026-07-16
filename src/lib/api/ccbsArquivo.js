import { supabase } from '@/lib/supabaseClient';
import { getEmpresaView } from '@/lib/tenantView';

// Gestão/arquivo de CCBs geradas: banco completo (campos ricos + jsonb),
// download do PDF (link assinado), status do espelho no Drive e log/auditoria.
const SELECT = `
  id, numero, status, forca_executiva, modalidade,
  valor_principal, valor_liberado, valor_total, taxa_mensal, taxa_anual,
  cet_mensal, cet_anual, iof, tarifa_cadastro, prazo,
  primeiro_vencimento, ultimo_vencimento, credor_nome, credor_cnpj,
  correspondente_nome, banco_credito, agencia_credito, conta_credito, tipo_conta,
  praca_pagamento, dados_extraidos, created_at, assinada_em,
  proposta:propostas(id, empresa_id, cliente:clientes(nome, cpf)),
  contrato:contratos(id, numero_contrato)
`;

export const ccbsArquivoApi = {
  async list() {
    const { data, error } = await supabase.from('ccbs').select(SELECT)
      .order('created_at', { ascending: false }).limit(1000);
    if (error) throw error;
    const ev = getEmpresaView();
    let rows = data || [];
    if (ev) rows = rows.filter((r) => r.proposta?.empresa_id === ev);
    return rows;
  },

  // Detalhe operacional: ingestão de origem (PDF/Drive/modelo), tentativas de
  // leitura e trilha de auditoria — o "log" completo daquela CCB.
  async detalhe(ccbId) {
    const out = { ing: null, pdfUrl: null, tentativas: [], audit: [] };
    try {
      const { data: ing } = await supabase.from('ingestoes_documento')
        .select('id, storage_path, drive_file_id, drive_sincronizado_em, confianca, modelo_usado, divergencias, arquivo_nome')
        .eq('ccb_id', ccbId).maybeSingle();
      out.ing = ing || null;
      if (ing?.storage_path) {
        const { data: signed } = await supabase.storage.from('ccb-docs').createSignedUrl(ing.storage_path, 3600);
        out.pdfUrl = signed?.signedUrl || null;
      }
      if (ing?.id) {
        const { data: t } = await supabase.from('ingestao_tentativas').select('*')
          .eq('ingestao_id', ing.id).order('created_at', { ascending: false });
        out.tentativas = t || [];
      }
      const ids = [ccbId, ing?.id].filter(Boolean);
      const orExpr = ids.map((i) => `registro_id.eq.${i}`).join(',');
      const { data: a } = await supabase.from('auditoria')
        .select('acao, created_at, valor_novo').or(orExpr).order('created_at', { ascending: false }).limit(30);
      out.audit = a || [];
    } catch { /* melhor esforço — detalhe parcial */ }
    return out;
  },

  async pdfUrl(storagePath) {
    if (!storagePath) return null;
    const { data } = await supabase.storage.from('ccb-docs').createSignedUrl(storagePath, 3600);
    return data?.signedUrl || null;
  },
};
