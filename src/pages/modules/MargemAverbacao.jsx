import React from 'react';
import { useTabParam } from '@/lib/useTabParam';
import ConsultaMargem from '@/pages/modules/ConsultaMargem';
import Averbacoes from '@/pages/modules/Averbacoes';
import ReconciliacaoMargem from '@/pages/modules/ReconciliacaoMargem';

const TABS = [
  { key: 'consulta', label: 'Consulta de Margem' },
  { key: 'averbacoes', label: 'Averbações' },
  { key: 'reconciliacao', label: 'Reconciliação' },
];

export default function MargemAverbacao() {
  const [tab, setTab] = useTabParam('consulta');
  const render = () => {
    if (tab === 'consulta') return <ConsultaMargem />;
    if (tab === 'averbacoes') return <Averbacoes />;
    return <ReconciliacaoMargem />;
  };
  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto overflow-y-hidden">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              tab === t.key ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {render()}
    </div>
  );
}
