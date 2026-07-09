// Regras de senha do CONSIGTEC — mínimo 8 caracteres, com letra e número.
export function validarSenha(senha) {
  if (!senha || senha.length < 8) return 'A senha deve ter ao menos 8 caracteres.';
  if (!/[A-Za-z]/.test(senha)) return 'A senha deve conter ao menos uma letra.';
  if (!/[0-9]/.test(senha)) return 'A senha deve conter ao menos um número.';
  return null; // válida
}
