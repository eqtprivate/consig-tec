import React from 'react';

// Estado vazio / carregando padronizado — convida à ação em vez de só informar.
export default function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-12 px-4 ${className}`}>
      {Icon && (
        <span className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
          <Icon className="w-6 h-6 text-muted-foreground" />
        </span>
      )}
      {title && <p className="text-sm font-semibold text-foreground">{title}</p>}
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
