import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ============================================================
// Smoke test (Item 0 do ciclo de endurecimento).
// Objetivo: se um import faltar em um componente montado em toda pagina logada
// (foi o caso de `AREA_SUBITEMS is not defined` na Sidebar, que derrubou o app
// inteiro em loading infinito), o render lanca e ESTE teste falha — barrando o
// merge no CI. Estatico (no-undef no lint) + dinamico (este render) cobrem os
// dois lados: import ausente detectado em lint E em runtime de render.
// ============================================================

// Contexto de auth com o shape que a Sidebar consome.
vi.mock('@/lib/ConsigtecAuthContext', () => ({
  useAuth: () => ({
    perfil: { nome: 'QA Teste', email: 'qa@consigtec.com.br', role: 'admin', ativo: true },
    isAdmin: true,
    isSuperadmin: false,
    activeUnidade: null,
    vinculos: [],
    hasAreaAccess: () => true,
    brand: null,
    menuConfig: null,
  }),
}));

// APIs que a Sidebar chama em useEffect — resolvem sem tocar rede.
vi.mock('@/lib/api/areas', () => ({
  areasApi: {
    list: () => Promise.resolve([
      { codigo: 'formalizacao', nome: 'Formalizacao' },
      { codigo: 'financeiro', nome: 'Financeiro' },
    ]),
  },
}));
vi.mock('@/lib/api/dashboard', () => ({
  dashboardApi: {
    contadores: () => Promise.resolve({ ingestoes_conferencia: 2, pendencias_abertas: 1 }),
  },
}));

// Import DEPOIS dos mocks (hoisting do vi.mock garante que valem no import).
import Sidebar from '@/components/Sidebar';

describe('Sidebar (smoke)', () => {
  it('monta sem lancar e renderiza a navegacao', () => {
    const { container } = render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );
    // Se um import faltasse, o render acima ja teria lancado.
    expect(container.querySelector('aside')).toBeTruthy();
    // Grupo fixo sempre presente (independe de carregamento assincrono).
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('monta em modo colapsado sem lancar', () => {
    const { container } = render(
      <MemoryRouter>
        <Sidebar collapsed />
      </MemoryRouter>,
    );
    expect(container.querySelector('aside')).toBeTruthy();
  });
});
