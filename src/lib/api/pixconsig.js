import { supabase } from '@/lib/supabaseClient';

// Dispara o full sync da API PixConsig (função backend syncPixconsig).
export const pixconsigApi = {
  async sync(opts = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/functions/syncPixconsig', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify(opts),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Falha ao sincronizar');
    return data; // { configurado, total, ok, ignorados, paginas, erros }
  },

  // Painel de status: config + estado do cron + espelho + últimas execuções.
  async status() {
    const { data, error } = await supabase.rpc('status_sync_pixconsig');
    if (error) throw error;
    return data; // { config, cron, espelho, execucoes, reconciliacao }
  },

  // Progresso ao vivo do sync em andamento (para a barra do painel).
  async progresso() {
    const { data, error } = await supabase.rpc('progresso_sync_pixconsig');
    if (error) throw error;
    return data; // { total, processados, pagina, rodando, mensagem, ... } | null
  },

  // Feed de novidades da sincronização (novas prefeituras, mudanças de status…).
  async novidades(limit = 100) {
    const { data, error } = await supabase.rpc('novidades_sync_pixconsig', { p_limit: limit });
    if (error) throw error;
    return data; // { ultima, resumo_24h, itens: [...] }
  },

  // Regrava a janela/intervalo do cron (horas em BRT) e persiste a preferência.
  async configurar({ intervalo_horas, hora_inicio, hora_fim, ativo }) {
    const { data, error } = await supabase.rpc('configurar_sync_pixconsig', {
      p_intervalo: intervalo_horas, p_hora_inicio: hora_inicio, p_hora_fim: hora_fim, p_ativo: ativo,
    });
    if (error) throw error;
    return data; // config aplicada
  },
};
