// Máscaras de exibição para campos extraídos (conferência de CCB).
// Padrão: exibir formatado, ARMAZENAR limpo (dígitos p/ CPF/CNPJ/CEP/tel; ISO
// p/ datas) — assim a aprovação/gravação continua consistente com o resto do app.

export const onlyDigits = (v) => String(v ?? '').replace(/\D/g, '');

export const maskCPF = (v) => {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

export const maskCNPJ = (v) => {
  const d = onlyDigits(v).slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

export const maskCEP = (v) => onlyDigits(v).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');

export const maskTelefone = (v) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d{1,4})$/, '$1-$2');
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2');
};

// Datas: extração devolve ISO (AAAA-MM-DD). Exibe DD/MM/AAAA; armazena ISO.
export const isoToBR = (v) => {
  const s = String(v ?? '').trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
};
export const brToISO = (v) => {
  const s = String(v ?? '').trim();
  const d = onlyDigits(s);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);      // já ISO
  if (d.length === 8) return `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`; // DDMMYYYY → ISO
  return s;
};
// Máscara enquanto digita a data em BR.
export const maskDataBR = (v) => onlyDigits(v).slice(0, 8)
  .replace(/(\d{2})(\d)/, '$1/$2')
  .replace(/(\d{2})(\d)/, '$1/$2');

// Moeda: exibe "R$ 1.500,50"; digita em CENTAVOS (dígitos da direita p/ esquerda);
// ARMAZENA um number (reais). Round-trip ok pois o valor guardado tem 2 casas.
export const displayMoeda = (v) => {
  if (v == null || v === '') return '';
  const n = Number(v);
  return Number.isFinite(n)
    ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '';
};
export const storeMoeda = (v) => {
  const d = onlyDigits(v);
  if (!d) return null;
  return parseInt(d, 10) / 100;
};

// Aplica máscara de EXIBIÇÃO conforme o tipo do campo.
export function displayMask(tipo, v) {
  switch (tipo) {
    case 'cpf': return maskCPF(v);
    case 'cnpj': return maskCNPJ(v);
    case 'cep': return maskCEP(v);
    case 'telefone': return maskTelefone(v);
    case 'data': return isoToBR(v);
    default: return v ?? '';
  }
}
// Converte o texto digitado no valor a ARMAZENAR.
export function storeMask(tipo, v) {
  switch (tipo) {
    case 'cpf':
    case 'cnpj':
    case 'cep':
    case 'telefone': return onlyDigits(v);
    case 'data': return brToISO(maskDataBR(v));
    default: return v;
  }
}
