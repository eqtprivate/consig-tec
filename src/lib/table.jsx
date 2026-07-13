import React, { useState } from 'react';
import { ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react';

// Controles reutilizáveis de tabela: ordenação por cabeçalho + helper de sort.
// Uso:
//   const { sort, toggle } = useSortable('nome', 'asc');
//   const linhas = sortRows(dados, sort, { cidade: (r) => r.entidade?.cidade });
//   <SortTh label="Nome" sortKey="nome" sort={sort} onSort={toggle} />

export function useSortable(defaultKey = null, defaultDir = 'asc') {
  const [sort, setSort] = useState({ key: defaultKey, dir: defaultDir });
  const toggle = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  return { sort, toggle, setSort };
}

// Ordena estável, com nulos sempre por último; números como número, texto com
// collation pt-BR (numeric) para "10" > "9".
export function sortRows(rows, sort, getters = {}) {
  if (!sort?.key) return rows;
  const get = getters[sort.key] || ((r) => r[sort.key]);
  const dir = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    const na = va == null || va === '';
    const nb = vb == null || vb === '';
    if (na && nb) return 0;
    if (na) return 1;
    if (nb) return -1;
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
    if (typeof va === 'boolean' && typeof vb === 'boolean') return (Number(va) - Number(vb)) * dir;
    return String(va).localeCompare(String(vb), 'pt-BR', { numeric: true, sensitivity: 'base' }) * dir;
  });
}

export function SortTh({ label, sortKey, sort, onSort, align = 'left', className = '' }) {
  const active = sort?.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ChevronUp : ChevronDown;
  return (
    <th
      className={`px-4 py-3 font-medium uppercase text-xs select-none ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 transition-colors hover:text-primary ${active ? 'text-primary' : 'text-slate-500'} ${align === 'right' ? 'flex-row-reverse' : ''}`}
        title="Ordenar"
      >
        {label}
        <Icon className={`w-3 h-3 ${active ? 'opacity-100' : 'opacity-40'}`} />
      </button>
    </th>
  );
}

// Normaliza texto para busca (sem acento, minúsculo).
export const norm = (v) =>
  String(v ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
