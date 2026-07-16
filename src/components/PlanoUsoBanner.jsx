import React from 'react';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { AlertTriangle, Package } from 'lucide-react';

// Uso × limites do plano da empresa. Só AVISA (não bloqueia).
const linhas = [
  { key: 'usuarios', limite: 'limite_usuarios', label: 'Usuários' },
  { key: 'convenios', limite: 'limite_convenios', label: 'Convênios' },
  { key: 'propostas_mes', limite: 'limite_propostas_mes', label: 'Propostas (mês)' },
  { key: 'leituras_ccb_mes', limite: 'limite_leituras_ccb_mes', label: 'Leituras CCB (mês)' },
  { key: 'documentos', limite: 'limite_documentos', label: 'Documentos' },
  { key: 'armazenamento_mb', limite: 'limite_armazenamento_mb', label: 'Armazenamento (MB)' },
];

export default function PlanoUsoBanner() {
  const { planoUso, plano } = useAuth();
  const p = planoUso?.plano || plano;
  const uso = planoUso?.uso;
  if (!p) return null;

  const itens = linhas.map((l) => {
    const usado = Number(uso?.[l.key] || 0);
    const limite = p[l.limite];
    const excedido = limite != null && usado > limite;
    const pct = limite ? Math.min(100, Math.round((usado / limite) * 100)) : 0;
    return { ...l, usado, limite, excedido, pct };
  });
  const algumExcedido = itens.some((i) => i.excedido);

  return (
    <div className={`rounded-xl border p-4 ${algumExcedido ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Package className="w-4 h-4 text-primary" /> Plano {p.nome}</p>
        {algumExcedido && <span className="text-[11px] text-amber-700 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> limite excedido</span>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {itens.map((i) => (
          <div key={i.key}>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-slate-500">{i.label}</span>
              <span className={`font-semibold ${i.excedido ? 'text-amber-700' : 'text-slate-700'}`}>
                {i.usado.toLocaleString('pt-BR')} / {i.limite == null ? '∞' : i.limite.toLocaleString('pt-BR')}
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded overflow-hidden">
              <div className={`h-full rounded ${i.excedido ? 'bg-amber-500' : 'bar-brand'}`} style={{ width: `${i.limite == null ? 6 : i.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
