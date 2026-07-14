import React from 'react';
import { useTabParam } from '@/lib/useTabParam';
import Chamados from '@/pages/modules/Chamados';
import ChamadosInternos from '@/pages/modules/ChamadosInternos';

const TABS = [
  { key: 'internos', label: 'Chamados Internos' },
  { key: 'suporte', label: 'Chamados (suporte)' },
];

export default function Suporte() {
  const [tab, setTab] = useTabParam('internos');
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
      {tab === 'internos' ? <ChamadosInternos /> : <Chamados />}
    </div>
  );
}
