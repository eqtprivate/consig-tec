import React, { useState } from 'react';
import Leads from '@/pages/modules/Leads';
import Clientes from '@/pages/modules/Clientes';
import Propostas from '@/pages/modules/Propostas';
import Campanhas from '@/pages/modules/Campanhas';

const TABS = [
  { key: 'leads', label: 'Leads' },
  { key: 'clientes', label: 'Tomadores' },
  { key: 'propostas', label: 'Propostas' },
  { key: 'campanhas', label: 'Campanhas' },
];

export default function CrmVendas() {
  const [tab, setTab] = useState('leads');
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
      {tab === 'leads' ? <Leads /> : tab === 'clientes' ? <Clientes /> : tab === 'propostas' ? <Propostas /> : <Campanhas />}
    </div>
  );
}
