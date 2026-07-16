import React, { useState } from 'react';
import { X } from 'lucide-react';

// Editor de lista como chips (opções consolidadas). Aceita array ou string
// (uma por linha) e devolve sempre um array via onChange. Enter/vírgula adiciona;
// Backspace no campo vazio remove o último; clique no X remove um item.
export default function TagList({ items, onChange, placeholder = 'Adicionar item e Enter…' }) {
  const [txt, setTxt] = useState('');
  const arr = Array.isArray(items)
    ? items
    : (items ? String(items).split(/\n|,/).map((s) => s.trim()).filter(Boolean) : []);

  const add = (v) => {
    const t = String(v || '').trim().replace(/,$/, '');
    if (!t) return;
    if (!arr.some((x) => x.toLowerCase() === t.toLowerCase())) onChange([...arr, t]);
    setTxt('');
  };
  const rm = (i) => onChange(arr.filter((_, k) => k !== i));

  return (
    <div className="rounded-md border border-border bg-card p-2 flex flex-wrap gap-1.5 min-h-[38px]">
      {arr.map((it, i) => (
        <span key={`${it}-${i}`} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded-full pl-2 pr-1 py-0.5">
          <span className="max-w-[220px] truncate">{it}</span>
          <button type="button" onClick={() => rm(i)} className="rounded-full hover:bg-primary/20 p-0.5" aria-label="Remover"><X className="w-3 h-3" /></button>
        </span>
      ))}
      <input
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(txt); }
          else if (e.key === 'Backspace' && !txt && arr.length) { rm(arr.length - 1); }
        }}
        onBlur={() => add(txt)}
        placeholder={arr.length ? '' : placeholder}
        className="flex-1 min-w-[140px] text-sm bg-transparent outline-none px-1"
      />
    </div>
  );
}
