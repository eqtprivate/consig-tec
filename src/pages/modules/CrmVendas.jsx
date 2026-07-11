import React, { useState } from 'react';
import Clientes from '@/pages/modules/Clientes';
import Propostas from '@/pages/modules/Propostas';

const TABS = [
  { key: 'clientes', label: 'Tomadores' },
  { key: 'propostas', label: 'Propostas' },
];

export default function CrmVendas() {
  const [tab, setTab] = useState('clientes');
  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'clientes' ? <Clientes /> : <Propostas />}
    </div>
  );
}
