import React, { useEffect, useState } from 'react';
import { auditoriaApi } from '@/lib/api/auditoria';
import { Input } from '@/components/ui/input';
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
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Auditoria</h1>
        <p className="text-sm text-slate-500 mt-1">Logs de ações do sistema</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3 text-slate-500">
          <Filter className="w-4 h-4" />
          <span className="text-xs font-medium uppercase tracking-wider">Filtros</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
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
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">Carregando...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">Nenhum log encontrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Data/Hora</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Usuário</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ação</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden md:table-cell">Entidade</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden lg:table-cell">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{log.usuario?.nome || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                      {log.acao}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{log.entidade || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">
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