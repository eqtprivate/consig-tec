import React, { useEffect, useMemo, useState } from 'react';
import { monitorApi } from '@/lib/api/conciliacao';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { EmptyState, StatusBadge, StatCard } from '@/components/kit';
import { Radar, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

function competenciaAtual() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

export default function MonitorCaptura() {
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!competencia.trim()) return;
    setLoading(true);
    try { setRows(await monitorApi.captura(competencia.trim())); }
    catch (err) { toast.error(err.message || 'Falha ao carregar o monitor.'); setRows([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [competencia]); // eslint-disable-line react-hooks/exhaustive-deps

  const kpi = useMemo(() => {
    const total = rows.length;
    const capturados = rows.filter((r) => r.capturado).length;
    const conciliados = rows.filter((r) => r.status === 'conciliado').length;
    const abertas = rows.reduce((s, r) => s + (r.ocorrencias_abertas || 0), 0);
    return { total, capturados, faltando: total - capturados, conciliados, abertas };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Competência (AAAA-MM)</Label>
          <Input value={competencia} onChange={(e) => setCompetencia(e.target.value)} className="w-40" placeholder="2026-07" />
        </div>
        <Button variant="outline" onClick={load} className="gap-2"><RefreshCw className="w-4 h-4" /> Atualizar</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatCard label="Convênios" value={kpi.total} />
        <StatCard label="Retorno capturado" value={`${kpi.capturados}/${kpi.total}`} hint={`${kpi.faltando} faltando`} />
        <StatCard label="Conciliados" value={kpi.conciliados} />
        <StatCard label="Ocorrências abertas" value={kpi.abertas} />
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
        {loading ? <EmptyState title="Carregando…" />
        : rows.length === 0 ? <EmptyState icon={Radar} title="Sem convênios" description="Cadastre convênios para monitorar a captura." />
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Convênio</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden md:table-cell">Averbadora</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden sm:table-cell">Dia retorno</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Captura</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Conciliação</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Ocorr. abertas</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.convenio_id} className="border-b border-border hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium text-foreground">{r.convenio}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{r.averbadora || '—'}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground num hidden sm:table-cell">{r.dia_retorno || '—'}</td>
                  <td className="px-4 py-3">
                    {r.capturado
                      ? <span className="inline-flex items-center gap-1 text-xs text-green-700"><CheckCircle2 className="w-3.5 h-3.5" /> capturado</span>
                      : <span className="inline-flex items-center gap-1 text-xs text-red-600"><AlertTriangle className="w-3.5 h-3.5" /> faltando</span>}
                  </td>
                  <td className="px-4 py-3">
                    {r.status ? <StatusBadge className={r.status === 'conciliado' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}>{r.status}</StatusBadge> : <span className="text-xs text-muted-foreground/60">—</span>}
                  </td>
                  <td className={`px-4 py-3 text-right num ${r.ocorrencias_abertas > 0 ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>{r.ocorrencias_abertas || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
