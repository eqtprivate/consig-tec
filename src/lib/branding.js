// White-label por empresa: KITS de cores (temas) que alteram todo o layout —
// primária, sidebar e realces — sobrescrevendo os tokens CSS no <html> em tempo
// de execução (inline > classes light/dark). Não toca no index.css.

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

const triplet = (hex) => { const h = hexToHsl(hex); return h ? `${h.h} ${h.s}% ${h.l}%` : null; };
const contrast = (hex) => { const h = hexToHsl(hex); return (h && h.l < 62) ? '0 0% 100%' : '222 47% 11%'; };

// ---- KITS de cores (paleta pré-definida) ------------------------------------
// primary  → botões/links/realces (bg-primary, text-primary, --ring)
// sidebar  → fundo da barra lateral (escuro)
// accent   → cor de destaque/ativo dentro da sidebar
export const THEMES = [
  { key: 'consigtec', nome: 'CONSIGTEC (padrão)', primary: '#1E293B', sidebar: '#0F1B2D', accent: '#0EA5E9' },
  { key: 'indigo',    nome: 'Índigo',             primary: '#4F46E5', sidebar: '#1E1B4B', accent: '#818CF8' },
  { key: 'esmeralda', nome: 'Esmeralda',          primary: '#059669', sidebar: '#06281F', accent: '#34D399' },
  { key: 'oceano',    nome: 'Oceano',             primary: '#0D9488', sidebar: '#0A2A2E', accent: '#2DD4BF' },
  { key: 'violeta',   nome: 'Violeta',            primary: '#7C3AED', sidebar: '#2A1065', accent: '#A78BFA' },
  { key: 'rubi',      nome: 'Rubi',               primary: '#E11D48', sidebar: '#2B0B12', accent: '#FB7185' },
  { key: 'ambar',     nome: 'Âmbar & Grafite',    primary: '#D97706', sidebar: '#1C1917', accent: '#FBBF24' },
  { key: 'grafite',   nome: 'Grafite',            primary: '#334155', sidebar: '#0F172A', accent: '#94A3B8' },
];
export const getTheme = (key) => THEMES.find((t) => t.key === key) || null;

// Todos os tokens que os kits controlam (para limpeza/reset).
const ALL_VARS = [
  '--primary', '--primary-foreground', '--ring',
  '--sidebar-background', '--sidebar-foreground', '--sidebar-primary', '--sidebar-primary-foreground',
  '--sidebar-accent', '--sidebar-accent-foreground', '--sidebar-border', '--sidebar-ring',
];

function clearAll() {
  const root = document.documentElement;
  ALL_VARS.forEach((v) => root.style.removeProperty(v));
}

// Aplica um kit inteiro (primária + sidebar + realces), em light e dark.
export function applyTheme(kit) {
  if (!kit) return clearAll();
  const root = document.documentElement;
  const set = (v, val) => val && root.style.setProperty(v, val);
  const bg = hexToHsl(kit.sidebar) || { h: 222, s: 47, l: 11 };

  set('--primary', triplet(kit.primary));
  set('--primary-foreground', contrast(kit.primary));
  set('--ring', triplet(kit.primary));

  set('--sidebar-background', triplet(kit.sidebar));
  set('--sidebar-foreground', '210 40% 98%');
  set('--sidebar-primary', triplet(kit.accent));
  set('--sidebar-primary-foreground', contrast(kit.accent));
  set('--sidebar-ring', triplet(kit.accent));
  // realces internos da sidebar derivados do próprio fundo (hover/borda)
  set('--sidebar-accent', `${bg.h} ${bg.s}% ${Math.min(bg.l + 7, 30)}%`);
  set('--sidebar-accent-foreground', '210 40% 98%');
  set('--sidebar-border', `${bg.h} ${bg.s}% ${Math.min(bg.l + 10, 34)}%`);
}

// Compat: aplica só a cor primária (modo legado, sem kit).
function applyColorOnly(cor) {
  const t = triplet(cor);
  if (!t) return clearAll();
  const root = document.documentElement;
  root.style.setProperty('--primary', t);
  root.style.setProperty('--ring', t);
  root.style.setProperty('--sidebar-primary', t);
  root.style.setProperty('--sidebar-ring', t);
  root.style.setProperty('--primary-foreground', contrast(cor));
  root.style.setProperty('--sidebar-primary-foreground', contrast(cor));
}

// Ponto de entrada: escolhe kit (tema) ou cor avulsa; limpa se nada.
export function applyBranding({ tema, cor_primaria } = {}) {
  const kit = getTheme(tema);
  if (kit) return applyTheme(kit);
  if (cor_primaria) return applyColorOnly(cor_primaria);
  return clearAll();
}
