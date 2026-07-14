import React from 'react';

// Container de card padrão (tokens: bg-card/border-border + elevação sutil).
// Opcionalmente renderiza um cabeçalho com título/subtítulo e uma ação à direita.
export default function Panel({ title, subtitle, action, className = '', bodyClassName = '', children, ...props }) {
  return (
    <div className={`bg-card rounded-xl border border-border shadow-sm p-5 ${className}`} {...props}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-foreground truncate">{title}</h2>}
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children != null && <div className={bodyClassName}>{children}</div>}
    </div>
  );
}
