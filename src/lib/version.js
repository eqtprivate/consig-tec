/* eslint-disable no-undef */
// Injetados em build pelo Vite (define). Fallback para ambiente sem define.
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
export const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '';

export function buildLabel() {
  if (!BUILD_TIME) return `v${APP_VERSION}`;
  const d = new Date(BUILD_TIME);
  const fmt = d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return `v${APP_VERSION} · ${fmt}`;
}
