import { displayDate, displayDateOnly } from './lib-date';
// lib.events.ts — Event bus سراسری (وب + موبایل)
const _listeners: Set<Function> = new Set();

export function emitHawalaUpdate(): void {
  _listeners.forEach((fn) => {
    try { fn(); } catch (e) { console.log('event listener err:', e); }
  });
}

export function onHawalaUpdate(fn: Function): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}
