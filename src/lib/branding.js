// White-label por empresa: aplica a cor primária do tenant em tempo de execução
// sobrescrevendo os tokens CSS no <html> (inline > classes light/dark). Não toca
// no index.css — assim não colide com o sistema de design.

// #RGB | #RRGGBB → { h, s, l } (0-360, 0-100, 0-100)
export function hexToHsl(hex) {
  let c = String(hex || '').trim().replace(/^#/, '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(c)) return null;
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0; const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h *= 60; if (h < 0) h += 360;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

const VARS = ['--primary', '--ring', '--sidebar-primary', '--sidebar-ring'];
const FG_VARS = ['--primary-foreground', '--sidebar-primary-foreground'];

// Aplica (ou limpa) a cor primária da empresa. cor = hex ou null/''.
export function applyBrandColor(cor) {
  const root = document.documentElement;
  const hsl = cor ? hexToHsl(cor) : null;
  if (!hsl) {
    VARS.concat(FG_VARS).forEach((v) => root.style.removeProperty(v));
    return;
  }
  const triplet = `${hsl.h} ${hsl.s}% ${hsl.l}%`;
  VARS.forEach((v) => root.style.setProperty(v, triplet));
  // Texto sobre a cor: claro em fundos escuros, escuro em fundos claros.
  const fg = hsl.l < 62 ? '0 0% 100%' : '222 47% 11%';
  FG_VARS.forEach((v) => root.style.setProperty(v, fg));
}
