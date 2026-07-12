import { useSearchParams } from 'react-router-dom';

// Aba controlada pela query string (?tab=), para permitir deep-link a partir
// do menu lateral (subitens colapsáveis). Mantém a URL em sincronia.
export function useTabParam(defaultKey) {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') || defaultKey;
  const setTab = (k) => {
    const next = new URLSearchParams(sp);
    next.set('tab', k);
    setSp(next, { replace: true });
  };
  return [tab, setTab];
}
