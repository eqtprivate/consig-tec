import { supabase } from '@/lib/supabaseClient';

// Cliente compartilhado para chamar Edge Functions. Usa XMLHttpRequest quando
// há callback de progresso (o fetch não expõe progresso de upload) — assim a
// UI mostra uma barra real de bytes enviados no upload do PDF. Sem callback,
// comporta-se como um POST JSON comum e devolve o corpo já parseado.
export function callFn(fn, payload, onUploadProgress) {
  return new Promise((resolve, reject) => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/functions/${fn}`);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Authorization', `Bearer ${session?.access_token || ''}`);
      if (typeof onUploadProgress === 'function' && xhr.upload) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onUploadProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
        };
        xhr.upload.onload = () => onUploadProgress(100);
      }
      xhr.onload = () => {
        let data = {};
        try { data = JSON.parse(xhr.responseText || '{}'); } catch { /* corpo vazio/erro */ }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error || 'Operação falhou'));
      };
      xhr.onerror = () => reject(new Error('Falha de rede no envio.'));
      xhr.ontimeout = () => reject(new Error('Tempo esgotado no envio.'));
      xhr.send(JSON.stringify(payload));
    }).catch(reject);
  });
}
