import React from 'react';
import { useTabParam } from '@/lib/useTabParam';
import ConveniosDashboard from '@/pages/modules/ConveniosDashboard';
import Convenios from '@/pages/modules/Convenios';
import CapacidadeMunicipios from '@/pages/modules/CapacidadeMunicipios';
import IngestaoDecreto from '@/pages/modules/IngestaoDecreto';
import ArquivoDecretos from '@/pages/modules/ArquivoDecretos';

const TABS = [
  { key: 'visao', label: 'Visão Geral' },
  { key: 'convenios', label: 'Convênios & Produtos' },
  { key: 'capacidade', label: 'Capacidade por Município' },
  { key: 'decretos', label: 'Decretos (IA)' },
  { key: 'arquivo-decretos', label: 'Arquivo de Decretos' },
];

export default function ConveniosArea() {
  const [tab, setTab] = useTabParam('visao');
  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-border overflow-x-auto overflow-y-hidden">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'visao' ? <ConveniosDashboard /> : tab === 'convenios' ? <Convenios /> : tab === 'capacidade' ? <CapacidadeMunicipios /> : tab === 'decretos' ? <IngestaoDecreto /> : <ArquivoDecretos />}
    </div>
  );
}
