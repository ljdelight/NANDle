// Small DOM helpers shared by the UI modules.

export function $<T extends Element = HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing element ${selector}`);
  return el;
}

export function closestData(target: EventTarget | null, attr: string): HTMLElement | SVGElement | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest(`[data-${attr}]`);
  return el instanceof HTMLElement || el instanceof SVGElement ? el : null;
}

/** Narrow screens get the compact circuit layout. */
export const narrowScreen: MediaQueryList = window.matchMedia('(max-width: 520px)');

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export function toast(msg: string): void {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

export function shake(): void {
  const el = $('.circuit-card');
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}
