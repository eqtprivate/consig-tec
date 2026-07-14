// Regras de senha do CONSIGTEC — fonte única (checklist + validação usam a mesma).
// Mínimo 8 caracteres, com ao menos uma letra e um número.
export const REGRAS_SENHA = [
  { chave: 'tamanho', label: 'Pelo menos 8 caracteres', testa: (s) => (s || '').length >= 8 },
  { chave: 'letra', label: 'Uma letra (a–z)', testa: (s) => /[A-Za-z]/.test(s || '') },
  { chave: 'numero', label: 'Um número (0–9)', testa: (s) => /[0-9]/.test(s || '') },
];

export function validarSenha(senha) {
  const falha = REGRAS_SENHA.find((r) => !r.testa(senha));
  if (!falha) return null; // válida
  if (falha.chave === 'tamanho') return 'A senha deve ter ao menos 8 caracteres.';
  if (falha.chave === 'letra') return 'A senha deve conter ao menos uma letra.';
  return 'A senha deve conter ao menos um número.';
}
