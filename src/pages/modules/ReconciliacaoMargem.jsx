import React, { useEffect, useState } from 'react';
import { averbacoesApi } from '@/lib/api/averbacoes';
import { brl } from '@/lib/format';
import { CheckCircle2, Clock, AlertTriangle, Scale } from 'lucide-react';

const RES = {
  reservada: { label: 'Reservada', cls: 'bg-amber-50 text-amber-700', icon: Clock },
  efetivada: { label: 'Efetivada', cls: 'bg-green-50 text-green-700', icon: CheckCircle2 },
  liberada: { label: 'Liberada', cls: 'bg-slate-100 text-slate-400', icon: Clock },
};
const AVB = {
  pendente: 'Pendente', averbada: 'Averbada', recusada: 'Recusada', cancelada: 'Cancelada',
};

export default function ReconciliacaoMargem() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setRows(await averbacoesApi.reconciliacao().catch(() => []));
      setLoading(false);
    })();
  }, []);

  const totReservado = rows.filter((r) => r.status_reserva === 'reservada').reduce((s, r) => s + Number(r.valor_reservado || 0), 0);
  const totEfetivado = rows.filter((r) => r.status_reserva === 'efetivada').reduce((s, r) => s + Number(r.valor_reservado || 0), 0);
  const divergentes = rows.filter((r) => Math.abs(Number(r.divergencia || 0)) >= 0.01);

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">Reconciliação da margem apartada — reservado (proposta) × averbado (convênio). Divergências indicam ajuste do convênio na averbação.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Clock} label="Margem reservada (pendente)" value={brl(totReservado)} />
        <Kpi icon={CheckCircle2} label="Margem efetivada" value={brl(totEfetivado)} />
        <Kpi icon={Scale} label="Reservas ativas" value={String(rows.length)} />
        <Kpi icon={AlertTriangle} label="Divergências" value={String(divergentes.length)} tone={divergentes.length ? 'warn' : 'ok'} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">Carregando...</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">Nenhuma reserva de margem ativa.</div>
        ) : (
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Tomador</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden md:table-cell">Convênio / Matrícula</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Reservado</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Reserva</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Averbado</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden sm:table-cell">Averbação</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Divergência</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const res = RES[r.status_reserva] || RES.reservada;
                const ResIcon = res.icon;
                const div = Number(r.divergencia || 0);
                const temDiv = Math.abs(div) >= 0.01;
                return (
                  <tr key={r.proposta_id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{r.cliente || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{r.convenio || '—'}{r.matricula ? ` · #${r.matricula}` : ''}</td>
                    <td className="px-4 py-3 text-right text-slate-800">{brl(r.valor_reservado)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${res.cls}`}><ResIcon className="w-3 h-3" /> {res.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{r.valor_averbado != null ? brl(r.valor_averbado) : '—'}</td>
                    <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">{r.status_averbacao ? AVB[r.status_averbacao] : '—'}</td>
                    <td className={`px-4 py-3 text-right font-medium ${temDiv ? (div > 0 ? 'text-red-600' : 'text-amber-600') : 'text-slate-300'}`}>
                      {temDiv ? `${div > 0 ? '+' : ''}${brl(div)}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }) {
  const color = tone === 'warn' ? 'text-amber-600' : tone === 'ok' ? 'text-green-700' : 'text-slate-900';
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 text-slate-400 mb-1"><Icon className="w-4 h-4" /><span className="text-xs uppercase tracking-wide">{label}</span></div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
