import { supabase } from '@/lib/supabaseClient';
import { getEmpresaView } from '@/lib/tenantView';

// Modelos disponíveis para a leitura de CCB (curados). Custo por CCB é
// estimativa para ~5 páginas — só orientação de UI.
export const MODELOS_CCB = [
  { value: 'claude-haiku-4-5', label: 'Haiku 4.5', tag: 'mais barato', preco: 'US$ 1 / US$ 5 por 1M', custoCcb: '~US$ 0,015 / CCB' },
  { value: 'claude-sonnet-5', label: 'Sonnet 5', tag: 'equilibrado (padrão)', preco: 'US$ 3 / US$ 15 por 1M', custoCcb: '~US$ 0,04–0,06 / CCB' },
  { value: 'claude-opus-4-8', label: 'Opus 4.8', tag: 'máxima precisão', preco: 'US$ 5 / US$ 25 por 1M', custoCcb: '~US$ 0,10+ / CCB' },
];

export const MODELO_LABEL = Object.fromEntries(MODELOS_CCB.map((m) => [m.value, m.label]));

// Config por empresa (modelo + limite de confiança). Escrita via RPC autorizado.
export const ingestaoConfigApi = {
  async get() {
    const ev = getEmpresaView();
    let q = supabase.from('config_ingestao_ccb').select('*');
    if (ev) q = q.eq('empresa_id', ev);
    const { data, error } = await q.limit(1);
    if (error) throw error;
    return (data && data[0]) || null; // null → UI usa os defaults
  },
  async salvar({ modelo, confianca_minima }) {
    const { data, error } = await supabase.rpc('salvar_config_ingestao_ccb', {
      p_modelo: modelo,
      p_confianca: confianca_minima,
      p_empresa: getEmpresaView() || null,
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  },
  async salvarArquivamento({ drive_folder_id, drive_ativo }) {
    const { data, error } = await supabase.rpc('salvar_arquivamento_ccb', {
      p_drive_folder_id: drive_folder_id || null,
      p_drive_ativo: !!drive_ativo,
      p_empresa: getEmpresaView() || null,
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  },
  async tentativas(limit = 50) {
    const ev = getEmpresaView();
    let q = supabase.from('ingestao_tentativas').select('*').order('created_at', { ascending: false }).limit(limit);
    if (ev) q = q.eq('empresa_id', ev);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },
};
