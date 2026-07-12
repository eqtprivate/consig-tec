import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Tooltip enxuto para botões só-ícone. <Tip label="Editar"><button/></Tip>
export default function Tip({ label, side = 'top', children }) {
  if (!label) return children;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} className="text-xs">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
