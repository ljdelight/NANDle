// Rendering the puzzle page from the game state.
import * as C from '../circuit';
import type { SignalValues } from '../circuit';
import * as E from '../expr';
import { GATE_GUIDE } from '../gates';
import { termHtml } from '../glossary';
import * as L from '../logic';
import type { Gate, Score } from '../logic';
import { renderCoach, spotlightCoachTarget } from './coach';
import { $, narrowScreen } from './dom';
import { renderHelper } from './helper';
import { MAX_RUNS, filledGates, isDaily, isPlaying, practiceDifficulty, shownGates, state } from './state';

const PRAISE: readonly string[] = ['Genius!', 'Brilliant!', 'Impressive!', 'Nice work!', 'Solid!', 'Phew!'];

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

export function render(): void {
  renderModes();
  renderMeta();
  renderCircuit();
  renderPalette();
  renderTable();
  renderHelper();
  renderBoard();
  renderResult();
  renderCoach();
}

/** The pieces that change while a circuit is being edited. */
export function refreshPlay(): void {
  renderCircuit();
  renderPalette();
  renderBoard();
}

function renderModes(): void {
  document.querySelectorAll<HTMLButtonElement>('.mode').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode));
  });
  $('#practice-bar').hidden = state.mode !== 'practice';
  $('#difficulty').innerHTML = L.DIFFICULTIES
    .map((d) => `<button role="radio" aria-checked="${d === practiceDifficulty}" data-difficulty="${d}">${d}</button>`)
    .join('');
}

function renderMeta(): void {
  const p = state.puzzle;
  const title = isDaily(p) ? `Puzzle #${p.number}` : state.mode === 'tutorial' ? 'Tutorial' : 'Practice';
  const others = p.solutionCount > 1 ? ` · ${termHtml('equivalent', `${p.solutionCount} answers work`)}` : '';
  const palette = p.gates.length < L.GATES.length ? ` · ${p.gates.length} gate types` : '';
  $('#meta').innerHTML =
    `<span class="meta-title">${title}</span>` +
    `<span class="pill diff-${p.difficulty.toLowerCase()}">${p.difficulty}</span>` +
    `<span class="meta-sub">${plural(state.topo.gates.length, 'gate')} · ${plural(state.topo.inputs.length, 'input')}${palette}${others}</span>` +
    `<span class="meta-runs">${isPlaying() ? `Run ${state.guesses.length + 1}/${MAX_RUNS}` : `${state.guesses.length}/${MAX_RUNS} runs`}</span>`;
}

function probeValues(): SignalValues {
  const nodes = L.evaluatePartial(state.topo, shownGates(), state.probe);
  const values: SignalValues = { ...nodes.inputs };
  nodes.gates.forEach((v, i) => {
    if (v !== null) values[`g${i}`] = v;
  });
  return values;
}

export function renderCircuit(): void {
  const playing = isPlaying();
  const editing = playing && state.trace === null;
  renderTraceBar();
  $('#circuit').innerHTML = C.render(state.topo, {
    gates: shownGates(),
    selected: editing ? state.selected : null,
    interactive: editing,
    probe: true,
    values: probeValues(),
    target: state.puzzle.table[L.rowIndex(state.probe)] ?? null,
    compact: narrowScreen.matches,
  });
  renderFormula(editing ? state.selected : null);
  spotlightCoachTarget();
  const names = state.topo.inputs;
  $('#circuit-hint').textContent = playing
    ? `Tap a slot to pick its gate. Tap ${names[0]}–${names[names.length - 1]} to try inputs.`
    : 'Tap the inputs to probe the circuit.';
}

function renderTraceBar(): void {
  const bar = $('#trace-bar');
  const traced = state.trace === null ? undefined : state.guesses[state.trace];
  bar.hidden = !traced;
  if (!traced || state.trace === null) return;
  const row = L.rowIndex(state.probe);
  const inputs = state.topo.inputs.map((name, i) => `${name}=${state.probe[i]}`).join(', ');
  const got = traced.table[row];
  const want = state.puzzle.table[row];
  const verdict =
    got === want
      ? `gives <b>Q=${got}</b>, matching the target.`
      : `gives <b>Q=${got}</b>, but the target is <b>${want}</b>. Follow the 1s and 0s to find where it goes wrong.`;
  bar.className = 'trace-bar ' + (got === want ? 'match' : 'mismatch');
  bar.innerHTML =
    `<p><b>Run #${state.trace + 1}</b> at ${inputs} ${verdict}</p>` +
    `<button class="btn small" data-action="end-trace">${isPlaying() ? 'Back to editing' : 'Back'}</button>`;
}

function renderFormula(selected: number | null): void {
  const expr = E.circuitExpr(state.topo, shownGates());
  $('#formula').innerHTML = `<span class="fx-q">${termHtml('formula', 'Q =')}</span> ${E.exprHtml(expr, selected)}`;
}

function keyStatus(): Map<Gate, Score> {
  const rank: Readonly<Record<Score, number>> = { absent: 1, present: 2, correct: 3 };
  const best = new Map<Gate, Score>();
  for (const g of state.guesses) {
    g.gates.forEach((type, i) => {
      const s = g.score[i];
      if (!s) return;
      const prev = best.get(type);
      if (!prev || rank[s] > rank[prev]) best.set(type, s);
    });
  }
  return best;
}

export function renderPalette(): void {
  const playing = isPlaying();
  $('#controls').hidden = !playing;
  if (!playing) return;
  const status = keyStatus();
  const paletteEl = $('#palette');
  paletteEl.dataset.count = String(state.puzzle.gates.length);
  paletteEl.style.setProperty('--cols', String(state.puzzle.gates.length));
  paletteEl.innerHTML = state.puzzle.gates.map(
    (type, i) =>
      `<div class="gate-cell">` +
      `<button class="gate-btn ${status.get(type) ?? ''}" data-gate="${type}" title="${type}: ${GATE_GUIDE[type].rule}">` +
      `${C.iconSvg(type)}<span>${type}</span><kbd>${i + 1}</kbd></button>` +
      `<button class="gate-info" data-info="${type}" aria-label="What does ${type} do?" title="What does ${type} do?">i</button>` +
      `</div>`
  ).join('');
  $<HTMLButtonElement>('#btn-run').disabled = filledGates(state.current) === null;
}

interface TableCell {
  readonly text: string;
  readonly cls?: string;
  readonly title?: string;
  /** Past run this cell belongs to; tapping it traces that run. */
  readonly run?: number;
}

export function renderTable(): void {
  const target = state.puzzle.table;
  const n = state.topo.inputs.length;
  const probeRow = L.rowIndex(state.probe);
  const row = (cls: string, head: string, cell: (r: number) => TableCell): string => {
    const tds = target.map((_, r) => {
      const c = cell(r);
      const classes = [c.cls ?? '', r === probeRow ? 'probe' : ''].filter(Boolean).join(' ');
      const title = c.title ? ` title="${c.title}"` : '';
      const runAttr = c.run === undefined ? '' : ` data-run="${c.run}"`;
      return `<td${classes ? ` class="${classes}"` : ''}${title} data-col="${r}"${runAttr}>${c.text}</td>`;
    });
    return `<tr class="${cls}"><th scope="row">${head}</th>${tds.join('')}</tr>`;
  };
  let html = '<table class="tt"><tbody>';
  state.topo.inputs.forEach((name, i) => {
    html += row('in', name, (r) => ({ text: String(L.rowBits(r, n)[i]) }));
  });
  html += row('target', 'Q', (r) => ({ text: String(target[r]), cls: `v${target[r]}` }));
  state.guesses.forEach((g, gi) => {
    const traced = state.trace === gi ? ' traced' : '';
    html += row(`guess${traced}`, `#${gi + 1}`, (r) => {
      const ok = g.table[r] === target[r];
      return {
        text: String(g.table[r]),
        cls: ok ? 'hit' : 'miss',
        title: ok ? 'Matches. Tap to trace this run here.' : 'Wrong. Tap to trace how this run got it.',
        run: gi,
      };
    });
  });
  html += '</tbody></table>';
  $('#truth-table').innerHTML = html;
}

export function renderBoard(): void {
  const rows: string[] = [];
  const totalRows = state.puzzle.table.length;
  for (let i = 0; i < MAX_RUNS; i++) {
    const g = state.guesses[i];
    let tiles: string;
    let tail = '';
    if (g) {
      tiles = g.gates.map((type, k) => `<span class="tile ${g.score[k] ?? ''}">${type}</span>`).join('');
      tail = `<span class="rows">${g.matched}/${totalRows}</span>`;
      const formula = E.formatExpr(E.circuitExpr(state.topo, g.gates));
      rows.push(`<li class="board-row" title="Q = ${formula}">${tiles}${tail}</li>`);
      continue;
    } else if (i === state.guesses.length && state.status === 'playing') {
      tiles = state.current.map((type) => `<span class="tile pending">${type ?? ''}</span>`).join('');
    } else {
      tiles = state.current.map(() => '<span class="tile blank"></span>').join('');
    }
    rows.push(`<li class="board-row">${tiles}${tail}</li>`);
  }
  $('#board').innerHTML = rows.join('');
}

function renderResult(): void {
  const el = $('#result');
  const last = state.guesses[state.guesses.length - 1];
  // The tutorial's own coach card covers the ending.
  if (state.status === 'playing' || !last || state.mode === 'tutorial') {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const won = state.status === 'won';
  const runs = state.guesses.length;
  const solution = state.puzzle.solution.join(' · ');
  const headline = won ? `${PRAISE[runs - 1] ?? 'Solved!'} Solved in ${runs}/${MAX_RUNS}.` : 'Out of runs.';
  const sub = won
    ? last.gates.join(' · ') === solution
      ? 'You found the exact hidden circuit.'
      : `${termHtml('equivalent', 'Equivalent circuit')}! The hidden one was ${solution}.`
    : `The hidden circuit was ${solution}.`;
  const next =
    state.mode === 'daily'
      ? '<button class="btn ghost" data-action="practice">Practice puzzle</button>'
      : '<button class="btn ghost" data-action="new">Another one</button>';
  el.innerHTML =
    `<p class="headline">${headline}</p><p class="sub">${sub}</p>` +
    `<div class="control-row"><button class="btn primary" data-action="share">Share</button>${next}</div>`;
}

export function renderGateRef(): void {
  $('#gate-ref').innerHTML = L.GATES.map(
    (type) =>
      `<button class="ref-row" data-info="${type}">${C.iconSvg(type)}<b>${type}</b>` +
      `<code>${E.gateNotation(type)}</code><span>${GATE_GUIDE[type].rule}</span></button>`
  ).join('');
}
