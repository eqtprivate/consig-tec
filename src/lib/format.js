// Helpers de formatação/parse compartilhados pelos módulos.
export const brl = (v) =>
  v == null || v === '' ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const num = (v) => (v === '' || v == null ? null : Number(v));

export const dataBR = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
