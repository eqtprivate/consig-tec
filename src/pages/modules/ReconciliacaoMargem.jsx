import React, { useEffect, useState } from 'react';
import { averbacoesApi } from '@/lib/api/averbacoes';
import { brl } from '@/lib/format';
import { StatCard, StatusBadge, EmptyState } from '@/components/kit';
import { CheckCircle2, Clock, AlertTriangle, Scale } from 'lucide-react';

const RES = {
  reservada: { label: 'Reservada', cls: 'bg-amber-50 text-amber-700', icon: Clock },
  efetivada: { label: 'Efetivada', cls: 'bg-green-50 text-green-700', icon: CheckCircle2 },
  liberada: { label: 'Liberada', cls: 'bg-muted text-muted-foreground', icon: Clock },
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
      <p className="text-sm text-muted-foreground">Reconciliação da margem apartada — reservado (proposta) × averbado (convênio). Divergências indicam ajuste do convênio na averbação.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Clock} label="Margem reservada (pendente)" value={brl(totReservado)} />
        <StatCard icon={CheckCircle2} label="Margem efetivada" value={brl(totEfetivado)} />
        <StatCard icon={Scale} label="Reservas ativas" value={String(rows.length)} />
        <StatCard icon={AlertTriangle} label="Divergências" value={String(divergentes.length)} tone={divergentes.length ? 'amber' : 'green'} />
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
        {loading ? (
          <EmptyState title="Carregando…" />
        ) : rows.length === 0 ? (
          <EmptyState title="Nenhuma reserva de margem ativa." />
        ) : (
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Tomador</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden md:table-cell">Convênio / Matrícula</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Reservado</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Reserva</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Averbado</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden sm:table-cell">Averbação</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Divergência</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const res = RES[r.status_reserva] || RES.reservada;
                const ResIcon = res.icon;
                const div = Number(r.divergencia || 0);
                const temDiv = Math.abs(div) >= 0.01;
                return (
                  <tr key={r.proposta_id} className="border-b border-border hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium text-foreground">{r.cliente || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{r.convenio || '—'}{r.matricula ? ` · #${r.matricula}` : ''}</td>
                    <td className="px-4 py-3 text-right text-foreground">{brl(r.valor_reservado)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge className={`gap-1 ${res.cls}`}><ResIcon className="w-3 h-3" /> {res.label}</StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{r.valor_averbado != null ? brl(r.valor_averbado) : '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{r.status_averbacao ? AVB[r.status_averbacao] : '—'}</td>
                    <td className={`px-4 py-3 text-right font-medium ${temDiv ? (div > 0 ? 'text-red-600' : 'text-amber-600') : 'text-muted-foreground/60'}`}>
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
