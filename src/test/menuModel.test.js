import { describe, it, expect } from 'vitest';
import { AREA_SUBITEMS, buildCanonical, applyMenuConfig } from '@/lib/menuModel';

// Fixa o contrato do menu que a Sidebar depende — inclusive o export
// AREA_SUBITEMS, cujo import ausente derrubou o app.
describe('menuModel', () => {
  it('exporta AREA_SUBITEMS e monta o canonico com as paginas da area', () => {
    expect(AREA_SUBITEMS).toBeTruthy();
    expect(AREA_SUBITEMS.formalizacao.some((p) => p.key === 'ingestao')).toBe(true);

    const canon = buildCanonical([{ codigo: 'formalizacao', nome: 'Formalizacao' }]);
    const grupo = canon.find((g) => g.key === 'area:formalizacao');
    expect(grupo).toBeTruthy();
    expect(grupo.paginas.some((p) => p.key === 'ingestao')).toBe(true);
  });

  it('applyMenuConfig devolve a lista mesmo sem config', () => {
    const canon = buildCanonical([]);
    const out = applyMenuConfig(canon, null);
    expect(Array.isArray(out)).toBe(true);
    // Grupos fixos (dashboard/pendencias) sempre presentes.
    expect(out.some((g) => g.key === 'dashboard')).toBe(true);
  });
});
