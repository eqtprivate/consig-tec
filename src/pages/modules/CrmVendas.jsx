import React, { useState } from 'react';
import Leads from '@/pages/modules/Leads';
import Oportunidades from '@/pages/modules/Oportunidades';
import Clientes from '@/pages/modules/Clientes';
import Propostas from '@/pages/modules/Propostas';
import Campanhas from '@/pages/modules/Campanhas';
import PainelCallCenter from '@/pages/modules/PainelCallCenter';
import ConfigCallCenter from '@/pages/modules/ConfigCallCenter';
import Agenda from '@/pages/modules/Agenda';
import ComercialPlanejamento from '@/pages/modules/ComercialPlanejamento';

const TABS = [
  { key: 'leads', label: 'Leads & Discagem' },
  { key: 'agenda', label: 'Agenda' },
  { key: 'oportunidades', label: 'Oportunidades' },
  { key: 'clientes', label: 'Tomadores' },
  { key: 'propostas', label: 'Propostas' },
  { key: 'campanhas', label: 'Campanhas' },
  { key: 'comercial', label: 'Comercial' },
  { key: 'painel', label: 'Painel' },
  { key: 'config', label: 'Config' },
];

export default function CrmVendas() {
  const [tab, setTab] = useState('leads');
  const render = () => {
    switch (tab) {
      case 'leads': return <Leads />;
      case 'agenda': return <Agenda />;
      case 'oportunidades': return <Oportunidades />;
      case 'clientes': return <Clientes />;
      case 'propostas': return <Propostas />;
      case 'campanhas': return <Campanhas />;
      case 'comercial': return <ComercialPlanejamento />;
      case 'painel': return <PainelCallCenter />;
      case 'config': return <ConfigCallCenter />;
      default: return null;
    }
  };
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
      {render()}
    </div>
  );
}
