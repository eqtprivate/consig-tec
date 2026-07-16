import { useCallback, useEffect, useRef, useState } from 'react';

// Observa ingestões que estão em extração (fase 2, em segundo plano) e avisa
// quando cada uma conclui — MESMO que o operador feche o painel de conferência,
// envie vários documentos ou recarregue a página. Faz polling pontual por ID
// (independe do filtro da lista), então o sinal de "terminou" nunca se perde.
//
// getFn(id) → objeto da ingestão com { id, status, arquivo_nome, observacao }.
// onConcluido(full) / onErro(full) disparam uma única vez por documento.
export function useExtracaoWatcher({ getFn, onConcluido, onErro, intervaloMs = 4000 }) {
  const [pendentes, setPendentes] = useState([]); // ids ainda em 'extraindo'
  const timer = useRef(null);
  // Mantém os callbacks/getFn atuais sem reiniciar o intervalo a cada render.
  const cbs = useRef({ getFn, onConcluido, onErro });
  cbs.current = { getFn, onConcluido, onErro };

  // Passa a acompanhar um id (idempotente).
  const observar = useCallback((id) => {
    if (!id) return;
    setPendentes((p) => (p.includes(id) ? p : [...p, id]));
  }, []);

  // Acompanha vários de uma vez (ex.: ao (re)carregar a lista).
  const observarVarios = useCallback((ids) => {
    const novos = (ids || []).filter(Boolean);
    if (novos.length === 0) return;
    setPendentes((p) => Array.from(new Set([...p, ...novos])));
  }, []);

  useEffect(() => {
    if (pendentes.length === 0) { clearInterval(timer.current); timer.current = null; return; }
    clearInterval(timer.current);
    timer.current = setInterval(async () => {
      for (const id of [...pendentes]) {
        try {
          const full = await cbs.current.getFn(id);
          if (full && full.status && full.status !== 'extraindo') {
            setPendentes((p) => p.filter((x) => x !== id));
            if (full.status === 'erro') cbs.current.onErro?.(full);
            else cbs.current.onConcluido?.(full);
          }
        } catch { /* rede instável — mantém observando */ }
      }
    }, intervaloMs);
    return () => clearInterval(timer.current);
  }, [pendentes, intervaloMs]);

  useEffect(() => () => clearInterval(timer.current), []);

  return { observar, observarVarios, pendentesCount: pendentes.length };
}
