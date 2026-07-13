import React, { useEffect, useRef, useState } from 'react';

// Contador animado (ease-out). format recebe o número e devolve string.
export default function CountUp({ value, duration = 700, format }) {
  const to = Number(value) || 0;
  const [display, setDisplay] = useState(to);
  const state = useRef({ raf: 0, from: to });

  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setDisplay(to); state.current.from = to; return undefined; }
    const from = state.current.from;
    let startTs = null;
    const step = (ts) => {
      if (startTs === null) startTs = ts;
      const p = Math.min((ts - startTs) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1) state.current.raf = requestAnimationFrame(step);
      else state.current.from = to;
    };
    state.current.raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(state.current.raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, duration]);

  const fmt = format || ((n) => Math.round(n).toLocaleString('pt-BR'));
  return <>{fmt(display)}</>;
}
