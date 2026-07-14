import React from 'react';

// KPI tile padrão. Valor numérico usa `.num` (JetBrains Mono tabular).
const TONES = {
  primary: 'bg-primary/10 text-primary',
  green: 'bg-green-50 text-green-600',
  amber: 'bg-amber-50 text-amber-600',
  blue: 'bg-blue-50 text-blue-600',
  red: 'bg-red-50 text-red-600',
};

export default function StatCard({ label, value, icon: Icon, tone = 'primary', hint }) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        {Icon && (
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${TONES[tone] || TONES.primary}`}>
            <Icon className="w-4 h-4" />
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground num">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
