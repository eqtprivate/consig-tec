import React from 'react';
import { REGRAS_SENHA } from '@/lib/validators';
import { Check, Circle } from 'lucide-react';

// Lista de requisitos da senha que vai dando "check" conforme são atendidos.
// Opcionalmente inclui a regra "as senhas coincidem" quando `confirma` é passado.
export default function PasswordChecklist({ senha = '', confirma, className = '' }) {
  const itens = REGRAS_SENHA.map((r) => ({ label: r.label, ok: r.testa(senha) }));
  if (confirma !== undefined) {
    itens.push({ label: 'As senhas coincidem', ok: senha.length > 0 && senha === confirma });
  }
  return (
    <ul className={`space-y-1 ${className}`}>
      {itens.map((it, i) => (
        <li key={i} className={`flex items-center gap-2 text-xs transition-colors ${it.ok ? 'text-green-600' : 'text-muted-foreground'}`}>
          <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${it.ok ? 'bg-green-100' : 'bg-muted'}`}>
            {it.ok ? <Check className="w-3 h-3" /> : <Circle className="w-1.5 h-1.5 fill-current opacity-40" />}
          </span>
          <span className={it.ok ? 'line-through decoration-green-600/40' : ''}>{it.label}</span>
        </li>
      ))}
    </ul>
  );
}
