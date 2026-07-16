import React, { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Check, ChevronsUpDown, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Combobox pesquisável de convênio — a digitação filtra a lista (útil com
// centenas/milhares de convênios, onde um <select> é inviável). Suporta a opção
// "criar novo". value: id do convênio | '__novo__' | ''. onChange(id).
export default function ConvenioPicker({
  convenios = [], value, onChange, allowCreate = true, createHint = '',
  placeholder = 'Selecionar convênio…', limite = 50,
}) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState('');

  const selecionado = useMemo(() => convenios.find((c) => c.id === value) || null, [convenios, value]);
  const rotulo = value === '__novo__'
    ? `Criar novo convênio${createHint ? ` — ${createHint}` : ''}`
    : (selecionado ? selecionado.nome : placeholder);

  const filtrados = useMemo(() => {
    const q = norm(busca);
    const base = !q ? convenios : convenios.filter((c) => norm(`${c.nome} ${c.orgao || ''}`).includes(q));
    return base.slice(0, limite);
  }, [convenios, busca, limite]);
  const excedente = Math.max(0, (busca ? filtrados.length : convenios.length) - filtrados.length);

  const escolher = (id) => { onChange(id); setOpen(false); setBusca(''); };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setBusca(''); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'h-8 text-sm rounded-md border border-border bg-card px-2 flex-1 min-w-[220px] flex items-center justify-between gap-2',
            value === '__novo__' ? 'text-green-700' : (!selecionado && value !== '__novo__' ? 'text-muted-foreground' : 'text-foreground'),
          )}
        >
          <span className="truncate">{rotulo}</span>
          <ChevronsUpDown className="w-3.5 h-3.5 opacity-50 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[min(440px,92vw)]" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={busca} onValueChange={setBusca} placeholder="Digite para buscar convênio…" />
          <CommandList>
            {allowCreate && (
              <CommandGroup>
                <CommandItem value="__novo__" onSelect={() => escolher('__novo__')} className="text-green-700">
                  <PlusCircle className="w-4 h-4" /> Criar novo convênio{createHint ? ` — ${createHint}` : ''}
                </CommandItem>
              </CommandGroup>
            )}
            {filtrados.length === 0
              ? <CommandEmpty>Nenhum convênio encontrado.</CommandEmpty>
              : (
                <CommandGroup heading="Convênios">
                  {filtrados.map((c) => (
                    <CommandItem key={c.id} value={c.id} onSelect={() => escolher(c.id)}>
                      <Check className={cn('w-4 h-4', value === c.id ? 'opacity-100' : 'opacity-0')} />
                      <span className="truncate">{c.nome}{c.orgao ? ` · ${c.orgao}` : ''}</span>
                    </CommandItem>
                  ))}
                  {excedente > 0 && (
                    <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
                      Refine a busca — mostrando os primeiros {limite}.
                    </p>
                  )}
                </CommandGroup>
              )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
