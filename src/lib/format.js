// Helpers de formatação/parse compartilhados pelos módulos.
export const brl = (v) =>
  v == null || v === '' ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const num = (v) => (v === '' || v == null ? null : Number(v));

// Câmbio para exibir custos da IA (cobrados em US$) em R$. MVP: valor fixo —
// ajuste aqui quando quiser. brlUsd() recebe um valor EM US$ e formata em R$.
export const USD_BRL = 5.5;
export const brlUsd = (v) => (v == null || v === '' ? '—' : brl(Number(v) * USD_BRL));

export const dataBR = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
