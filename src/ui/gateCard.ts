// The gate card: a dialog that teaches one gate with a live one-gate circuit.
import * as C from '../circuit';
import * as E from '../expr';
import { GATE_GUIDE, gateTable } from '../gates';
import * as L from '../logic';
import type { Bit, Gate } from '../logic';
import { $, closestData, narrowScreen } from './dom';
import { state } from './state';

interface GateCard {
  gate: Gate;
  a: Bit;
  b: Bit;
}

let gateCard: GateCard | null = null;

export function openGateCard(gate: Gate): void {
  gateCard = { gate, a: 0, b: 0 };
  renderGateCard();
  const dlg = $<HTMLDialogElement>('#dlg-gate');
  if (!dlg.open) dlg.showModal();
}

function renderGateCard(): void {
  if (!gateCard) return;
  const { gate, a, b } = gateCard;
  const out = L.GATE_FN[gate](a, b);
  const guide = GATE_GUIDE[gate];
  // A live one-gate circuit, drawn with the same renderer as the puzzle.
  const circuit = C.render(L.TOPOLOGIES.single, {
    gates: [gate],
    selected: null,
    interactive: false,
    probe: true,
    values: { A: a, B: b, g0: out },
    target: null,
    compact: narrowScreen.matches,
  });
  const rows = gateTable(gate)
    .map((r) => {
      const now = r.a === a && r.b === b;
      return `<tr${now ? ' class="now"' : ''}><td>${r.a}</td><td>${r.b}</td><td class="v${r.out}">${r.out}</td></tr>`;
    })
    .join('');
  const canUse = state.status === 'playing' && state.puzzle.gates.includes(gate);
  $('#gate-card').innerHTML =
    `<div class="gc-head">${C.iconSvg(gate)}<div><h2 id="gate-card-title">${gate}</h2>` +
    (guide.say ? `<span class="gc-say">${guide.say}</span>` : '') +
    `<code>${E.gateNotation(gate)}</code></div></div>` +
    `<p class="gc-rule">${guide.rule}.</p>` +
    `<div class="gc-try"><div class="gc-circuit">${circuit}</div>` +
    `<table class="gc-tt" aria-label="${gate} truth table"><thead><tr><th>A</th><th>B</th><th>Q</th></tr></thead>` +
    `<tbody>${rows}</tbody></table></div>` +
    `<p class="gc-hint">Tap <b>A</b> and <b>B</b> to try it.</p>` +
    `<p class="gc-analogy"><span aria-hidden="true">💡</span> ${guide.analogy}</p>` +
    (guide.note ? `<p class="fine">${guide.note}</p>` : '') +
    (canUse
      ? `<div class="dialog-actions"><button class="btn primary" data-use="${gate}">Use in gate ${state.selected + 1}</button></div>`
      : '');
}

/** `onUse` places the gate chosen with the card's "Use in gate N" button. */
export function bindGateCard(onUse: (gate: Gate) => void): void {
  $('#gate-card').addEventListener('click', (e: MouseEvent) => {
    if (!gateCard) return;
    const input = closestData(e.target, 'input')?.dataset.input;
    if (input === 'A') gateCard.a = gateCard.a ? 0 : 1;
    else if (input === 'B') gateCard.b = gateCard.b ? 0 : 1;
    const use = closestData(e.target, 'use')?.dataset.use;
    if (L.isGate(use)) {
      $<HTMLDialogElement>('#dlg-gate').close();
      onUse(use);
      return;
    }
    if (input) renderGateCard();
  });
  $('#gate-card').addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    const input = closestData(e.target, 'input');
    if (!input) return;
    e.preventDefault();
    input.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  $('#gate-ref').addEventListener('click', (e: MouseEvent) => {
    const info = closestData(e.target, 'info')?.dataset.info;
    if (L.isGate(info)) openGateCard(info);
  });
}
