// Glossary popover for dotted-underlined terms, and the full list in the help dialog.
import { GLOSSARY, TERM_ORDER, isTermId } from '../glossary';
import type { TermId } from '../glossary';
import { $, closestData } from './dom';

const MARGIN = 12;

let openFor: HTMLElement | SVGElement | null = null;

function showTerm(anchor: HTMLElement | SVGElement, id: TermId): void {
  const pop = $('#glossary-pop');
  const term = GLOSSARY[id];
  pop.innerHTML = `<p class="gp-name">${term.name}</p><p class="gp-def">${term.definition}</p>`;
  // A popover sits in the top layer, so it also shows above an open dialog.
  if (!pop.matches(':popover-open')) pop.showPopover();
  openFor = anchor;
  // Below the term, kept inside the viewport.
  const a = anchor.getBoundingClientRect();
  const width = Math.min(320, window.innerWidth - 2 * MARGIN);
  const left = Math.min(Math.max(MARGIN, a.left + a.width / 2 - width / 2), window.innerWidth - width - MARGIN);
  pop.style.width = `${width}px`;
  pop.style.left = `${left}px`;
  const below = a.bottom + 8;
  const fitsBelow = below + pop.offsetHeight < window.innerHeight - MARGIN;
  pop.style.top = `${fitsBelow ? below : Math.max(MARGIN, a.top - pop.offsetHeight - 8)}px`;
}

export function renderGlossaryList(): void {
  $('#glossary-list').innerHTML = TERM_ORDER.map(
    (id) => `<div><dt>${GLOSSARY[id].name}</dt><dd>${GLOSSARY[id].definition}</dd></div>`
  ).join('');
}

function hideTerm(): void {
  const pop = $('#glossary-pop');
  if (pop.matches(':popover-open')) pop.hidePopover();
  openFor = null;
}

export function bindGlossary(): void {
  const pop = $('#glossary-pop');
  // Terms appear all over (cards, dialogs, the coach), so listen at the top. The
  // popover is "manual" so tapping the same term again can close it.
  document.addEventListener('click', (e: MouseEvent) => {
    const el = closestData(e.target, 'term');
    const id = el?.dataset.term;
    if (el && isTermId(id)) {
      e.preventDefault();
      e.stopPropagation();
      if (openFor === el) hideTerm();
      else showTerm(el, id);
      return;
    }
    if (openFor && !(e.target instanceof Node && pop.contains(e.target))) hideTerm();
  });
  // Capture phase, so Escape closes the popover before it closes a dialog or a trace.
  document.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !openFor) return;
      e.preventDefault();
      e.stopPropagation();
      hideTerm();
    },
    true
  );
  window.addEventListener('resize', hideTerm);
}
