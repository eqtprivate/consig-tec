import React from 'react';

// Chip de status com forma padronizada (rounded-full, tamanho/pesos consistentes).
// `tone` cobre os casos comuns; `className` permite cores específicas da tela.
const TONES = {
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-green-50 text-green-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  info: 'bg-blue-50 text-blue-700',
};

export default function StatusBadge({ tone, className = '', children }) {
  const base = tone ? (TONES[tone] || TONES.neutral) : '';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${base} ${className}`}>
      {children}
    </span>
  );
}
