import React, { useState } from 'react';
import Convenios from '@/pages/modules/Convenios';
import CapacidadeMunicipios from '@/pages/modules/CapacidadeMunicipios';

const TABS = [
  { key: 'convenios', label: 'Convênios & Produtos' },
  { key: 'capacidade', label: 'Capacidade por Município' },
];

export default function ConveniosArea() {
  const [tab, setTab] = useState('convenios');
  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
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
      {tab === 'convenios' ? <Convenios /> : <CapacidadeMunicipios />}
    </div>
  );
}
