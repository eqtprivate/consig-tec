import React, { useState, useEffect } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Confirmação imperativa (substitui window.confirm) — retorna Promise<boolean>.
// Uso: if (!(await confirmar('Remover?'))) return;
let resolver = null;
let current = null;
const listeners = new Set();

export function confirmar(opts) {
  return new Promise((resolve) => {
    resolver = resolve;
    current = typeof opts === 'string' ? { description: opts } : (opts || {});
    listeners.forEach((l) => l());
  });
}

export function ConfirmHost() {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const opts = current || {};
  const open = !!current;
  const done = (val) => {
    const r = resolver;
    current = null; resolver = null;
    tick((n) => n + 1);
    if (r) r(val);
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) done(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{opts.title || 'Confirmar'}</AlertDialogTitle>
          {opts.description && <AlertDialogDescription>{opts.description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => done(false)}>{opts.cancelText || 'Cancelar'}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => done(true)}
            className={opts.destructive ? 'bg-red-600 hover:bg-red-700 focus:ring-red-600' : ''}
          >
            {opts.confirmText || 'Confirmar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
