import { describe, it, vi } from 'vitest';

// ============================================================
// Smoke de IMPORT (amplia o Item 0). Carrega TODOS os módulos de página e de
// componente; se algum falhar ao importar (caminho errado, erro de top-level,
// dependência inexistente), o teste daquele arquivo falha e o CI barra o merge.
// Complementa: lint (no-undef) pega referência indefinida; build pega caminho
// inválido; ESTE pega qualquer arquivo que sequer carrega — cobrindo as telas
// novas (decretos, Documentos de Superadmin) sem precisar montar cada uma.
// ============================================================

// Neutraliza o cliente Supabase (Proxy que lança ao acessar antes do init) e o
// contexto de auth, para que o mero import de módulos não dispare efeitos.
vi.mock('@/lib/supabaseClient', () => ({
  supabase: new Proxy({}, { get: () => () => Promise.resolve({ data: null, error: null }) }),
  getSupabase: () => ({}),
  initSupabase: () => Promise.resolve({}),
  isSupabaseConfigured: true,
}));

const modules = {
  ...import.meta.glob('/src/pages/**/*.jsx'),
  ...import.meta.glob('/src/components/**/*.jsx'),
};

describe('import smoke — todos os módulos carregam sem quebrar', () => {
  for (const [path, load] of Object.entries(modules)) {
    it(`importa ${path}`, async () => {
      await load(); // lança se o módulo falhar ao carregar
    });
  }
});
