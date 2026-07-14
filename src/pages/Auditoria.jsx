import React, { useEffect, useState } from 'react';
import { auditoriaApi } from '@/lib/api/auditoria';
import { Input } from '@/components/ui/input';
import { PageHeader, Panel, StatusBadge, EmptyState } from '@/components/kit';
import { Filter, Search } from 'lucide-react';

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function Auditoria() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ acao: '', entidade: '' });

  const load = async () => {
    setLoading(true);
    const data = await auditoriaApi.list(filters).catch(() => []);
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filters]);

  return (
    <div className="space-y-5">
      <PageHeader title="Auditoria" subtitle="Logs de ações do sistema" />

      <Panel className="p-4">
        <div className="flex items-center gap-2 mb-3 text-muted-foreground">
          <Filter className="w-4 h-4" />
          <span className="text-xs font-medium uppercase tracking-wider">Filtros</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por ação..."
              value={filters.acao}
              onChange={(e) => setFilters({ ...filters, acao: e.target.value })}
              className="pl-9"
            />
          </div>
          <Input
            placeholder="Filtrar por entidade..."
            value={filters.entidade}
            onChange={(e) => setFilters({ ...filters, entidade: e.target.value })}
          />
        </div>
      </Panel>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <EmptyState title="Carregando…" />
        ) : logs.length === 0 ? (
          <EmptyState icon={Search} title="Nenhum log encontrado." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Data/Hora</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Usuário</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Ação</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden md:table-cell">Entidade</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden lg:table-cell">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-border hover:bg-muted/50">
                  <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{log.usuario?.nome || '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge tone="neutral">
                      {log.acao}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{log.entidade || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                    {log.valor_novo ? JSON.stringify(log.valor_novo).slice(0, 80) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}