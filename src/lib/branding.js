// White-label por empresa: KITS de cores (temas) que alteram TODO o layout —
// primária, superfícies das páginas (fundo/cards/realces) E a barra lateral.
// Em vez de estilos inline no :root (que não distinguem light/dark), injetamos
// um <style id="brand-theme"> com regras :root{} e .dark{} próprias — assim as
// superfícies são tingidas corretamente em cada modo. Não altera o index.css.

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
// primary → botões/links/realces · sidebar → fundo da barra lateral (escuro) ·
// accent → destaque/ativo na sidebar. As superfícies das páginas recebem um tom
// sutil derivado da matiz da primária.
export const THEMES = [
  { key: 'consigtec', nome: 'CONSIGTEC (padrão)', primary: '#1E293B', sidebar: '#0F1B2D', accent: '#0EA5E9' },
  { key: 'azul',      nome: 'Azul Royal',         primary: '#2563EB', sidebar: '#0B1E3F', accent: '#60A5FA' },
  { key: 'ceu',       nome: 'Céu',                primary: '#0284C7', sidebar: '#082133', accent: '#38BDF8' },
  { key: 'indigo',    nome: 'Índigo',             primary: '#4F46E5', sidebar: '#1E1B4B', accent: '#818CF8' },
  { key: 'violeta',   nome: 'Violeta',            primary: '#7C3AED', sidebar: '#2A1065', accent: '#A78BFA' },
  { key: 'rosa',      nome: 'Rosa',               primary: '#DB2777', sidebar: '#3B0A24', accent: '#F472B6' },
  { key: 'rubi',      nome: 'Rubi',               primary: '#E11D48', sidebar: '#2B0B12', accent: '#FB7185' },
  { key: 'terracota', nome: 'Terracota',          primary: '#EA580C', sidebar: '#2A1109', accent: '#FB923C' },
  { key: 'ambar',     nome: 'Âmbar & Grafite',    primary: '#D97706', sidebar: '#1C1917', accent: '#FBBF24' },
  { key: 'lima',      nome: 'Lima',               primary: '#65A30D', sidebar: '#1A2A0A', accent: '#A3E635' },
  { key: 'verde',     nome: 'Verde',              primary: '#16A34A', sidebar: '#08240F', accent: '#4ADE80' },
  { key: 'esmeralda', nome: 'Esmeralda',          primary: '#059669', sidebar: '#06281F', accent: '#34D399' },
  { key: 'oceano',    nome: 'Oceano',             primary: '#0D9488', sidebar: '#0A2A2E', accent: '#2DD4BF' },
  { key: 'turquesa',  nome: 'Turquesa',           primary: '#0891B2', sidebar: '#08282E', accent: '#22D3EE' },
  { key: 'grafite',   nome: 'Grafite',            primary: '#334155', sidebar: '#0F172A', accent: '#94A3B8' },
  { key: 'ardosia',   nome: 'Ardósia',            primary: '#475569', sidebar: '#111827', accent: '#CBD5E1' },
];
export const getTheme = (key) => THEMES.find((t) => t.key === key) || null;

function styleEl() {
  let el = document.getElementById('brand-theme');
  if (!el) { el = document.createElement('style'); el.id = 'brand-theme'; document.head.appendChild(el); }
  return el;
}
function clearAll() { const el = document.getElementById('brand-theme'); if (el) el.textContent = ''; }

// Gera o bloco de tokens (superfícies + primária + sidebar) para um modo.
function tokensFor(kit, dark) {
  const p = hexToHsl(kit.primary) || { h: 215, s: 40, l: 20 };
  const bg = hexToHsl(kit.sidebar) || { h: 222, s: 47, l: 11 };
  const h = p.h;
  const s = Math.max(14, Math.min(p.s, 42));   // saturação base das superfícies
  const sSoft = Math.round(s * 0.7);
  const L = [];
  const push = (k, v) => v && L.push(`  ${k}: ${v};`);

  push('--primary', triplet(kit.primary));
  push('--primary-foreground', contrast(kit.primary));
  push('--ring', triplet(kit.primary));

  if (!dark) {
    push('--background', `${h} ${sSoft}% 97%`);
    push('--card', `${h} ${Math.round(sSoft * 0.6)}% 99%`);
    push('--popover', `${h} ${Math.round(sSoft * 0.6)}% 99%`);
    push('--muted', `${h} ${sSoft}% 95%`);
    push('--secondary', `${h} ${sSoft}% 96%`);
    push('--accent', `${h} ${s}% 91%`);
    push('--border', `${h} ${Math.round(sSoft * 0.8)}% 89%`);
    push('--input', `${h} ${Math.round(sSoft * 0.8)}% 89%`);
  } else {
    push('--background', `${h} ${s}% 7%`);
    push('--card', `${h} ${s}% 10%`);
    push('--popover', `${h} ${s}% 10%`);
    push('--muted', `${h} ${sSoft}% 17%`);
    push('--secondary', `${h} ${sSoft}% 17%`);
    push('--accent', `${h} ${sSoft}% 18%`);
    push('--border', `${h} ${sSoft}% 20%`);
    push('--input', `${h} ${sSoft}% 20%`);
  }

  // Sidebar (igual nos dois modos — sempre escura).
  push('--sidebar-background', triplet(kit.sidebar));
  push('--sidebar-foreground', '210 40% 98%');
  push('--sidebar-primary', triplet(kit.accent));
  push('--sidebar-primary-foreground', contrast(kit.accent));
  push('--sidebar-ring', triplet(kit.accent));
  push('--sidebar-accent', `${bg.h} ${bg.s}% ${Math.min(bg.l + 7, 30)}%`);
  push('--sidebar-accent-foreground', '210 40% 98%');
  push('--sidebar-border', `${bg.h} ${bg.s}% ${Math.min(bg.l + 10, 34)}%`);
  return L.join('\n');
}

// Aplica um kit inteiro via <style> (regras :root{} e .dark{}).
export function applyTheme(kit) {
  if (!kit) return clearAll();
  styleEl().textContent = `:root{\n${tokensFor(kit, false)}\n}\n.dark{\n${tokensFor(kit, true)}\n}`;
}

// Compat: só a cor primária (sem tingir superfícies), via <style>.
function applyColorOnly(cor) {
  const t = triplet(cor);
  if (!t) return clearAll();
  const fg = contrast(cor);
  const block = `  --primary: ${t};\n  --primary-foreground: ${fg};\n  --ring: ${t};\n  --sidebar-primary: ${t};\n  --sidebar-primary-foreground: ${fg};\n  --sidebar-ring: ${t};`;
  styleEl().textContent = `:root{\n${block}\n}\n.dark{\n${block}\n}`;
}

// Ponto de entrada: kit (tema) → cor avulsa → limpa.
export function applyBranding({ tema, cor_primaria } = {}) {
  const kit = getTheme(tema);
  if (kit) return applyTheme(kit);
  if (cor_primaria) return applyColorOnly(cor_primaria);
  return clearAll();
}
