// UI wiring: game state, rendering, input handling, persistence and sharing.
import './style.css';
import * as C from './circuit';
import * as E from './expr';
import { GATE_GUIDE, gateTable } from './gates';
import type { SignalValues } from './circuit';
import * as K from './kmap';
import type { Form } from './kmap';
import { expressionHtml, renderKMap } from './kmapView';
import * as L from './logic';
import * as T from './tutorial';
import type { StepId, TutorialEvent } from './tutorial';
import { shareText as formatShare } from './share';
import type { Bit, DailyPuzzle, Difficulty, Gate, Puzzle, Score, Topology } from './logic';

const MAX_RUNS = 6;
const STATS_KEY = 'nandle:stats';
const TUTORIAL_DONE_KEY = 'nandle:tutorial-done';
const HELPER_KEY = 'nandle:helper';
const SETTINGS_KEY = 'nandle:settings';
const dailyKey = (k: string): string => 'nandle:daily:' + k;

/** Modes reachable from the header; the tutorial is entered separately. */
type PlayMode = 'daily' | 'practice';
type Mode = PlayMode | 'tutorial';
type Status = 'playing' | 'won' | 'lost';

interface Guess {
  readonly gates: readonly Gate[];
  readonly score: readonly Score[];
  readonly table: readonly Bit[];
  readonly matched: number;
}

interface GameState {
  mode: Mode;
  puzzle: Puzzle | DailyPuzzle;
  topo: Topology;
  guesses: Guess[];
  current: (Gate | null)[];
  selected: number;
  status: Status;
  /** Current input values, one per topology input, for probing the circuit. */
  probe: Bit[];
  /** Current tutorial step; null outside the tutorial. */
  coach: StepId | null;
  /** Index of the past run being traced in the circuit view; null when editing. */
  trace: number | null;
}

interface SavedDaily {
  topoId: string;
  guesses: Gate[][];
  status: Status;
}

interface Settings {
  highContrast: boolean;
}

type HelperForm = Form | 'none';

interface HelperPrefs {
  open: boolean;
  form: HelperForm;
  markGuess: boolean;
}

interface Stats {
  played: number;
  won: number;
  streak: number;
  maxStreak: number;
  lastNumber: number | null;
  lastWonNumber: number | null;
  dist: number[];
}

/** Narrow screens get the compact circuit layout. */
const narrowScreen: MediaQueryList = window.matchMedia('(max-width: 520px)');

const PRAISE: readonly string[] = ['Genius!', 'Brilliant!', 'Impressive!', 'Nice work!', 'Solid!', 'Phew!'];

// ---------- DOM helpers ----------

function $<T extends Element = HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing element ${selector}`);
  return el;
}

function closestData(target: EventTarget | null, attr: string): HTMLElement | SVGElement | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest(`[data-${attr}]`);
  return el instanceof HTMLElement || el instanceof SVGElement ? el : null;
}

// ---------- storage ----------

const store = {
  get<T>(key: string, fallback: T, valid: (v: unknown) => v is T): T {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed: unknown = JSON.parse(raw);
      return valid(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable: progress just won't persist */
    }
  },
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isStatus(v: unknown): v is Status {
  return v === 'playing' || v === 'won' || v === 'lost';
}

function isSavedDaily(v: unknown): v is SavedDaily {
  return (
    isRecord(v) &&
    typeof v.topoId === 'string' &&
    isStatus(v.status) &&
    Array.isArray(v.guesses) &&
    v.guesses.every((g: unknown) => Array.isArray(g) && g.every(L.isGate))
  );
}

function isStats(v: unknown): v is Stats {
  return (
    isRecord(v) &&
    typeof v.played === 'number' &&
    typeof v.won === 'number' &&
    typeof v.streak === 'number' &&
    typeof v.maxStreak === 'number' &&
    Array.isArray(v.dist) &&
    v.dist.length === MAX_RUNS
  );
}

const isTrue = (v: unknown): v is boolean => v === true;

function isSettings(v: unknown): v is Settings {
  return isRecord(v) && typeof v.highContrast === 'boolean';
}

const isHelperForm = (v: unknown): v is HelperForm => v === 'none' || v === 'sop' || v === 'pos';

function isHelperPrefs(v: unknown): v is HelperPrefs {
  return isRecord(v) && typeof v.open === 'boolean' && isHelperForm(v.form) && typeof v.markGuess === 'boolean';
}

function isDaily(p: Puzzle | DailyPuzzle): p is DailyPuzzle {
  return 'number' in p;
}

// ---------- game state ----------

let state: GameState;
let practiceDifficulty: Difficulty = 'Medium';
// Until the player chooses, follow the operating system's contrast preference.
const settings: Settings = store.get<Settings>(
  SETTINGS_KEY,
  { highContrast: window.matchMedia('(prefers-contrast: more)').matches },
  isSettings
);

function applySettings(): void {
  if (settings.highContrast) document.documentElement.dataset.contrast = 'high';
  else delete document.documentElement.dataset.contrast;
  $<HTMLInputElement>('#set-contrast').checked = settings.highContrast;
}

const helper: HelperPrefs = store.get<HelperPrefs>(
  HELPER_KEY,
  { open: false, form: 'none', markGuess: true },
  isHelperPrefs
);

function startGame(mode: Mode, puzzle: Puzzle | DailyPuzzle): void {
  const topo = L.TOPOLOGIES[puzzle.topoId];
  state = {
    mode,
    puzzle,
    topo,
    guesses: [],
    current: topo.gates.map((): Gate | null => null),
    selected: 0,
    status: 'playing',
    probe: topo.inputs.map((): Bit => 0),
    coach: null,
    trace: null,
  };
}

function makeGuess(gates: readonly Gate[]): Guess {
  const table = L.truthTable(state.topo, gates);
  return {
    gates,
    score: L.scoreGuess(state.puzzle.solution, gates),
    table,
    matched: L.matchingRows(state.puzzle.table, table),
  };
}

function loadDaily(): void {
  const puzzle = L.dailyPuzzle(new Date());
  startGame('daily', puzzle);
  const saved = store.get<SavedDaily | null>(dailyKey(puzzle.dateKey), null, isSavedDaily);
  const fits = (gates: readonly Gate[]): boolean =>
    gates.length === puzzle.solution.length && gates.every((g) => puzzle.gates.includes(g));
  if (saved && saved.topoId === puzzle.topoId && saved.guesses.every(fits)) {
    state.guesses = saved.guesses.map(makeGuess);
    state.status = saved.status;
    if (state.status !== 'playing') finishBoard();
  }
}

function loadTutorial(): void {
  startGame('tutorial', L.tutorialPuzzle());
  state.coach = 'welcome';
}

function loadPractice(): void {
  const seed = Math.floor(Math.random() * 1e9);
  startGame('practice', L.practicePuzzle(practiceDifficulty, seed));
}

function saveDaily(): void {
  if (!isDaily(state.puzzle)) return;
  const saved: SavedDaily = {
    topoId: state.puzzle.topoId,
    guesses: state.guesses.map((g) => [...g.gates]),
    status: state.status,
  };
  store.set(dailyKey(state.puzzle.dateKey), saved);
}

const filledGates = (current: readonly (Gate | null)[]): Gate[] | null =>
  current.every((g): g is Gate => g !== null) ? [...current] : null;

// ---------- rendering ----------

function render(): void {
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

function renderModes(): void {
  document.querySelectorAll<HTMLButtonElement>('.mode').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode));
  });
  $('#practice-bar').hidden = state.mode !== 'practice';
  $('#difficulty').innerHTML = L.DIFFICULTIES
    .map((d) => `<button role="radio" aria-checked="${d === practiceDifficulty}" data-difficulty="${d}">${d}</button>`)
    .join('');
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

function renderMeta(): void {
  const p = state.puzzle;
  const title = isDaily(p) ? `Puzzle #${p.number}` : state.mode === 'tutorial' ? 'Tutorial' : 'Practice';
  const others = p.solutionCount > 1 ? ` · ${p.solutionCount} circuits fit` : '';
  const palette = p.gates.length < L.GATES.length ? ` · ${p.gates.length} gate types` : '';
  $('#meta').innerHTML =
    `<span class="meta-title">${title}</span>` +
    `<span class="pill diff-${p.difficulty.toLowerCase()}">${p.difficulty}</span>` +
    `<span class="meta-sub">${plural(state.topo.gates.length, 'gate')} · ${plural(state.topo.inputs.length, 'input')}${palette}${others}</span>` +
    `<span class="meta-runs">Run ${Math.min(state.guesses.length + 1, MAX_RUNS)}/${MAX_RUNS}</span>`;
}

/** The gates on show: a traced past run, or the circuit being built. */
function shownGates(): readonly (Gate | null)[] {
  const traced = state.trace === null ? undefined : state.guesses[state.trace];
  return traced ? traced.gates : state.current;
}

function probeValues(): SignalValues {
  const nodes = L.evaluatePartial(state.topo, shownGates(), state.probe);
  const values: SignalValues = { ...nodes.inputs };
  nodes.gates.forEach((v, i) => {
    if (v !== null) values[`g${i}`] = v;
  });
  return values;
}

function renderCircuit(): void {
  const playing = state.status === 'playing';
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

const isPlaying = (): boolean => state.status === 'playing';

/** Stops tracing; returns whether a trace was showing. */
function leaveTrace(): boolean {
  if (state.trace === null) return false;
  state.trace = null;
  renderTable();
  return true;
}

function renderFormula(selected: number | null): void {
  const expr = E.circuitExpr(state.topo, shownGates());
  $('#formula').innerHTML = `<span class="fx-q">Q =</span> ${E.exprHtml(expr, selected)}`;
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

function renderPalette(): void {
  const playing = state.status === 'playing';
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

function renderTable(): void {
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

const HELPER_FORMS: readonly [HelperForm, string][] = [
  ['none', 'Map only'],
  ['sop', 'Group 1s'],
  ['pos', 'Group 0s'],
];

function helperNotes(form: HelperForm): string {
  const notes: string[] = [];
  if (form === 'none') {
    notes.push(
      'Neighbouring cells differ by exactly one input (edges wrap). Blocks of 1, 2, 4 or 8 matching cells simplify to a single term.'
    );
  } else if (form === 'sop') {
    notes.push('Sum of products: AND terms feeding an OR, which is the same as NAND gates feeding a NAND.');
  } else {
    notes.push('Product of sums: OR terms feeding an AND, which is the same as NOR gates feeding a NOR.');
  }
  const parity = K.parityHint(state.puzzle.table, state.topo.inputs);
  if (parity) {
    const gate = parity.inverted ? 'XNOR' : 'XOR';
    notes.push(
      `Checkerboard: Q is the ${parity.inverted ? 'inverted ' : ''}parity of ${parity.vars.join(', ')}. ` +
        `No groups merge, so think ${gate}-style gates.`
    );
  }
  notes.push("Your circuit's shape is fixed, so use the map as a clue rather than a wiring diagram.");
  return notes.join(' ');
}

function renderHelper(): void {
  // Keep the first game uncluttered.
  $('#kmap-card').hidden = state.mode === 'tutorial';
  const btn = $('#btn-kmap');
  btn.textContent = helper.open ? 'Hide' : 'Show';
  btn.setAttribute('aria-expanded', String(helper.open));
  $('#kmap-body').hidden = !helper.open;
  if (!helper.open) return;

  $('#kmap-form').innerHTML = HELPER_FORMS.map(
    ([form, label]) => `<button role="radio" aria-checked="${form === helper.form}" data-form="${form}">${label}</button>`
  ).join('');
  const markBox = $<HTMLInputElement>('#kmap-guess');
  const last = state.guesses[state.guesses.length - 1];
  markBox.checked = helper.markGuess;
  markBox.disabled = !last;

  const { inputs } = state.topo;
  const form = helper.form;
  const groups = form === 'none' ? [] : K.minimize(state.puzzle.table, inputs.length, form);
  $('#kmap').innerHTML = renderKMap({
    inputs,
    table: state.puzzle.table,
    groups,
    guess: helper.markGuess && last ? last.table : null,
  });
  $('#kmap-expr').innerHTML = form === 'none' ? '' : `Q = ${expressionHtml(groups, inputs, form)}`;
  $('#kmap-expr').hidden = form === 'none';
  $('#kmap-notes').textContent = helperNotes(form);
}

function saveHelper(): void {
  store.set(HELPER_KEY, helper);
  renderHelper();
}

function renderBoard(): void {
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
      : `Equivalent circuit! The hidden one was ${solution}.`
    : `The hidden circuit was ${solution}.`;
  const next =
    state.mode === 'daily'
      ? '<button class="btn ghost" data-action="practice">Practice puzzle</button>'
      : '<button class="btn ghost" data-action="new">Another one</button>';
  el.innerHTML =
    `<p class="headline">${headline}</p><p class="sub">${sub}</p>` +
    `<div class="control-row"><button class="btn primary" data-action="share">Share</button>${next}</div>`;
}

// ---------- actions ----------

function selectSlot(i: number): void {
  if (state.status !== 'playing') return;
  leaveTrace();
  const count = state.current.length;
  state.selected = ((i % count) + count) % count;
  renderCircuit();
}

function refreshPlay(): void {
  renderCircuit();
  renderPalette();
  renderBoard();
}

function placeGate(type: Gate): void {
  if (state.status !== 'playing' || !state.puzzle.gates.includes(type)) return;
  leaveTrace();
  state.current[state.selected] = type;
  // Advance to the next empty slot, or stay put if the circuit is full.
  const count = state.current.length;
  for (let step = 1; step <= count; step++) {
    const idx = (state.selected + step) % count;
    if (!state.current[idx]) {
      state.selected = idx;
      break;
    }
  }
  refreshPlay();
  coachEvent({ kind: 'place', gate: type });
}

function clearSlot(): void {
  if (state.status !== 'playing') return;
  leaveTrace();
  if (state.current[state.selected]) state.current[state.selected] = null;
  else selectSlot(state.selected - 1);
  refreshPlay();
}

function clearAll(): void {
  if (state.status !== 'playing') return;
  leaveTrace();
  state.current = state.current.map((): Gate | null => null);
  state.selected = 0;
  render();
}

function run(): void {
  if (state.status !== 'playing') return;
  leaveTrace();
  const gates = filledGates(state.current);
  if (!gates) {
    toast('Fill every gate slot first');
    shake();
    return;
  }
  const key = gates.join(',');
  if (state.guesses.some((g) => g.gates.join(',') === key)) {
    toast('You already ran that circuit');
    shake();
    return;
  }
  const guess = makeGuess(gates);
  state.guesses.push(guess);
  if (guess.matched === state.puzzle.table.length) state.status = 'won';
  else if (state.guesses.length >= MAX_RUNS) state.status = 'lost';

  if (state.status === 'playing') {
    // Keep the correct gates in place for the next attempt.
    state.current = guess.gates.map((g, i): Gate | null => (guess.score[i] === 'correct' ? g : null));
    const firstEmpty = state.current.findIndex((g) => !g);
    state.selected = firstEmpty === -1 ? 0 : firstEmpty;
  } else {
    finishBoard();
    recordStats();
  }
  saveDaily();
  render();
  coachEvent({ kind: 'run', won: state.status === 'won' });
  if (state.status !== 'playing' && state.mode === 'daily') setTimeout(openStats, 1400);
}

function finishBoard(): void {
  const last = state.guesses[state.guesses.length - 1];
  state.current = state.status === 'won' && last ? [...last.gates] : [...state.puzzle.solution];
}

function toggleInput(name: string): void {
  const i = state.topo.inputs.findIndex((n) => n === name);
  if (i === -1) return;
  const value: Bit = state.probe[i] ? 0 : 1;
  state.probe[i] = value;
  renderCircuit();
  renderTable();
  const input = state.topo.inputs[i];
  if (input) coachEvent({ kind: 'toggle', input, value });
}

// ---------- gate card ----------

interface GateCard {
  gate: Gate;
  a: Bit;
  b: Bit;
}

let gateCard: GateCard | null = null;

function openGateCard(gate: Gate): void {
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

// ---------- tutorial ----------

let scrolledToStep: StepId | null = null;

function coachEvent(event: TutorialEvent): void {
  if (!state.coach) return;
  const next = T.advance(state.coach, event);
  if (next === state.coach) return;
  state.coach = next;
  if (next === 'done') store.set(TUTORIAL_DONE_KEY, true);
  renderCoach();
}

function runContext(): T.RunContext {
  const last = state.guesses[state.guesses.length - 1];
  return { gate: last?.gates[0] ?? null, matched: last?.matched ?? 0, rows: state.puzzle.table.length };
}

function renderCoach(): void {
  const el = $('#coach');
  document.body.classList.toggle('coaching', state.coach !== null);
  if (!state.coach) {
    el.hidden = true;
    spotlightCoachTarget();
    return;
  }
  const step = T.step(state.coach, runContext());
  const index = T.STEP_ORDER.indexOf(step.id) + 1;
  const actions =
    step.id === 'done'
      ? '<button class="btn primary" data-coach="daily">Play today\'s puzzle</button>' +
        '<button class="btn ghost" data-coach="practice">Practice: Beginner</button>'
      : step.next
        ? '<button class="btn primary" data-coach="next">Next</button>'
        : '';
  el.hidden = false;
  el.innerHTML =
    `<div class="coach-head"><span class="coach-step">Step ${index} of ${T.STEP_ORDER.length}</span>` +
    (step.id === 'done' ? '' : '<button class="coach-skip" data-coach="skip">Skip tutorial</button>') +
    `</div><h2>${step.title}</h2><p>${step.body}</p>` +
    (actions ? `<div class="coach-actions">${actions}</div>` : '');
  spotlightCoachTarget();
  if (scrolledToStep !== step.id) {
    scrolledToStep = step.id;
    const target = step.target ? document.querySelector(step.target) : null;
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/** Re-applied after every circuit render, since the SVG is rebuilt. */
function spotlightCoachTarget(): void {
  document.querySelectorAll('.coach-target').forEach((el) => el.classList.remove('coach-target'));
  const selector = state.coach ? T.step(state.coach, runContext()).target : null;
  if (selector) document.querySelector(selector)?.classList.add('coach-target');
}

function endTutorial(next: PlayMode): void {
  store.set(TUTORIAL_DONE_KEY, true);
  if (next === 'practice') practiceDifficulty = 'Beginner';
  switchMode(next);
}

function startTutorial(): void {
  scrolledToStep = null;
  loadTutorial();
  render();
  window.scrollTo({ top: 0 });
}

// ---------- stats ----------

function defaultStats(): Stats {
  return { played: 0, won: 0, streak: 0, maxStreak: 0, lastNumber: null, lastWonNumber: null, dist: [0, 0, 0, 0, 0, 0] };
}

function recordStats(): void {
  const puzzle = state.puzzle;
  if (!isDaily(puzzle)) return;
  const s = store.get<Stats>(STATS_KEY, defaultStats(), isStats);
  if (s.lastNumber === puzzle.number) return;
  s.played++;
  if (state.status === 'won') {
    s.won++;
    s.streak = s.lastWonNumber === puzzle.number - 1 ? s.streak + 1 : 1;
    s.maxStreak = Math.max(s.maxStreak, s.streak);
    s.lastWonNumber = puzzle.number;
    const slot = state.guesses.length - 1;
    s.dist[slot] = (s.dist[slot] ?? 0) + 1;
  } else {
    s.streak = 0;
  }
  s.lastNumber = puzzle.number;
  store.set(STATS_KEY, s);
}

function openStats(): void {
  const s = store.get<Stats>(STATS_KEY, defaultStats(), isStats);
  // A streak only counts if yesterday's (or today's) puzzle was won.
  const today = L.puzzleNumber(new Date());
  const streak = s.lastWonNumber !== null && s.lastWonNumber >= today - 1 ? s.streak : 0;
  const pct = s.played ? Math.round((100 * s.won) / s.played) : 0;
  const tiles: readonly [number, string][] = [
    [s.played, 'Played'],
    [pct, 'Win %'],
    [streak, 'Streak'],
    [s.maxStreak, 'Best'],
  ];
  $('#stats').innerHTML = tiles.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
  const max = Math.max(1, ...s.dist);
  const highlight = state.mode === 'daily' && state.status === 'won' ? state.guesses.length - 1 : -1;
  $('#dist').innerHTML = s.dist
    .map(
      (n, i) =>
        `<div class="dist-row"><span>${i + 1}</span><div class="bar${i === highlight ? ' now' : ''}" style="width:${Math.max(8, (100 * n) / max)}%">${n}</div></div>`
    )
    .join('');
  updateCountdown();
  $<HTMLDialogElement>('#dlg-stats').showModal();
}

function updateCountdown(): void {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const secs = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
  const pad = (n: number): string => String(n).padStart(2, '0');
  $('#next').textContent = `Next daily puzzle in ${pad(Math.floor(secs / 3600))}:${pad(Math.floor((secs % 3600) / 60))}:${pad(secs % 60)}`;
}

// ---------- sharing & feedback ----------

function shareText(): string {
  const p = state.puzzle;
  return formatShare({
    title: isDaily(p) ? `Nandle #${p.number} (${p.difficulty})` : `Nandle practice (${p.difficulty})`,
    runs: state.guesses,
    won: state.status === 'won',
    maxRuns: MAX_RUNS,
    rows: p.table.length,
    highContrast: settings.highContrast,
  });
}

function share(): void {
  const text = shareText();
  const done = (): void => toast('Copied results to clipboard');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}

function fallbackCopy(text: string, done: () => void): void {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    done();
  } catch {
    toast('Could not copy');
  }
  ta.remove();
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(msg: string): void {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

function shake(): void {
  const el = $('.circuit-card');
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

// ---------- events ----------

function newPractice(): void {
  loadPractice();
  render();
}

function switchMode(mode: PlayMode): void {
  if (mode === state.mode) return;
  // Leaving the tutorial any way counts as finishing it, so it won't reappear.
  if (state.mode === 'tutorial') store.set(TUTORIAL_DONE_KEY, true);
  if (mode === 'daily') loadDaily();
  else loadPractice();
  render();
}

const isMode = (v: string | undefined): v is PlayMode => v === 'daily' || v === 'practice';
const isDifficulty = (v: string | undefined): v is Difficulty =>
  v !== undefined && (L.DIFFICULTIES as readonly string[]).includes(v);

function bind(): void {
  const circuit = $('#circuit');
  circuit.addEventListener('click', (e: MouseEvent) => {
    const slot = closestData(e.target, 'slot');
    if (slot) return selectSlot(Number(slot.dataset.slot));
    const input = closestData(e.target, 'input');
    if (input?.dataset.input) toggleInput(input.dataset.input);
  });
  circuit.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    const input = closestData(e.target, 'input');
    if (input?.dataset.input) {
      e.preventDefault();
      e.stopPropagation();
      toggleInput(input.dataset.input);
    }
  });
  $('#truth-table').addEventListener('click', (e: MouseEvent) => {
    const cell = closestData(e.target, 'col');
    if (!cell) return;
    // Jump the circuit's inputs to this column; a run's cell also traces that run.
    state.probe = L.rowBits(Number(cell.dataset.col), state.topo.inputs.length);
    const traced = cell.dataset.run;
    state.trace = traced === undefined ? null : Number(traced);
    renderCircuit();
    renderTable();
    // On a phone the circuit is usually scrolled away by the time you reach the table.
    const card = $('.circuit-card');
    if (card.getBoundingClientRect().top < 0) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#trace-bar').addEventListener('click', (e: MouseEvent) => {
    if (closestData(e.target, 'action')?.dataset.action === 'end-trace' && leaveTrace()) renderCircuit();
  });
  $('#formula').addEventListener('click', (e: MouseEvent) => {
    const part = closestData(e.target, 'fx');
    if (part) selectSlot(Number(part.dataset.fx));
  });
  const palette = $('#palette');
  // Long-pressing a gate opens its card instead of placing it.
  let pressTimer: ReturnType<typeof setTimeout> | undefined;
  let longPressed = false;
  palette.addEventListener('pointerdown', (e: PointerEvent) => {
    const gate = closestData(e.target, 'gate')?.dataset.gate;
    if (!L.isGate(gate)) return;
    longPressed = false;
    pressTimer = setTimeout(() => {
      longPressed = true;
      openGateCard(gate);
    }, 500);
  });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel'] as const) {
    palette.addEventListener(type, () => clearTimeout(pressTimer));
  }
  palette.addEventListener('contextmenu', (e: MouseEvent) => {
    if (closestData(e.target, 'gate')) e.preventDefault();
  });
  palette.addEventListener('click', (e: MouseEvent) => {
    const info = closestData(e.target, 'info')?.dataset.info;
    if (L.isGate(info)) return openGateCard(info);
    if (longPressed) {
      longPressed = false;
      return;
    }
    const gate = closestData(e.target, 'gate')?.dataset.gate;
    if (L.isGate(gate)) placeGate(gate);
  });
  $('#gate-ref').addEventListener('click', (e: MouseEvent) => {
    const info = closestData(e.target, 'info')?.dataset.info;
    if (L.isGate(info)) openGateCard(info);
  });
  $('#gate-card').addEventListener('click', (e: MouseEvent) => {
    if (!gateCard) return;
    const input = closestData(e.target, 'input')?.dataset.input;
    if (input === 'A') gateCard.a = gateCard.a ? 0 : 1;
    else if (input === 'B') gateCard.b = gateCard.b ? 0 : 1;
    const use = closestData(e.target, 'use')?.dataset.use;
    if (L.isGate(use)) {
      $<HTMLDialogElement>('#dlg-gate').close();
      placeGate(use);
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
  $('#btn-run').addEventListener('click', run);
  $('#btn-clear').addEventListener('click', clearAll);
  $('#result').addEventListener('click', (e: MouseEvent) => {
    const action = closestData(e.target, 'action')?.dataset.action;
    if (action === 'share') share();
    else if (action === 'practice') switchMode('practice');
    else if (action === 'new') newPractice();
  });
  document.querySelectorAll<HTMLButtonElement>('.mode').forEach((b) => {
    b.addEventListener('click', () => {
      if (isMode(b.dataset.mode)) switchMode(b.dataset.mode);
    });
  });
  $('#difficulty').addEventListener('click', (e: MouseEvent) => {
    const difficulty = closestData(e.target, 'difficulty')?.dataset.difficulty;
    if (!isDifficulty(difficulty)) return;
    practiceDifficulty = difficulty;
    newPractice();
  });
  $('#btn-new').addEventListener('click', newPractice);
  $('#btn-kmap').addEventListener('click', () => {
    helper.open = !helper.open;
    saveHelper();
  });
  $('#kmap-form').addEventListener('click', (e: MouseEvent) => {
    const form = closestData(e.target, 'form')?.dataset.form;
    if (!isHelperForm(form)) return;
    helper.form = form;
    saveHelper();
  });
  // Spotlight a K-map group while its term is hovered, focused or tapped.
  const kmapBody = $('#kmap-body');
  const spotlight = (e: Event): void => {
    const group = closestData(e.target, 'group')?.dataset.group;
    if (group === undefined) delete kmapBody.dataset.focus;
    else kmapBody.dataset.focus = group;
  };
  const expr = $('#kmap-expr');
  expr.addEventListener('mouseover', spotlight);
  expr.addEventListener('focusin', spotlight);
  expr.addEventListener('click', spotlight);
  expr.addEventListener('mouseleave', () => delete kmapBody.dataset.focus);
  expr.addEventListener('focusout', () => delete kmapBody.dataset.focus);
  $<HTMLInputElement>('#kmap-guess').addEventListener('change', (e: Event) => {
    if (e.target instanceof HTMLInputElement) helper.markGuess = e.target.checked;
    saveHelper();
  });
  $('#btn-help').addEventListener('click', () => $<HTMLDialogElement>('#dlg-help').showModal());
  $('#btn-tutorial').addEventListener('click', () => {
    $<HTMLDialogElement>('#dlg-help').close();
    startTutorial();
  });
  $('#coach').addEventListener('click', (e: MouseEvent) => {
    const action = closestData(e.target, 'coach')?.dataset.coach;
    if (action === 'next') coachEvent({ kind: 'next' });
    else if (action === 'skip' || action === 'daily') endTutorial('daily');
    else if (action === 'practice') endTutorial('practice');
  });
  $('#btn-stats').addEventListener('click', openStats);
  $('#btn-settings').addEventListener('click', () => $<HTMLDialogElement>('#dlg-settings').showModal());
  $<HTMLInputElement>('#set-contrast').addEventListener('change', (e: Event) => {
    if (!(e.target instanceof HTMLInputElement)) return;
    settings.highContrast = e.target.checked;
    store.set(SETTINGS_KEY, settings);
    applySettings();
  });
  narrowScreen.addEventListener('change', renderCircuit);
  setInterval(() => {
    if ($<HTMLDialogElement>('#dlg-stats').open) updateCountdown();
  }, 1000);

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
    if (e.key === 'Escape' && leaveTrace()) {
      renderCircuit();
      return;
    }
    if (e.target instanceof Element && e.target.closest('button') && (e.key === 'Enter' || e.key === ' ')) return;
    const n = Number(e.key);
    const gate = Number.isInteger(n) && n >= 1 ? state.puzzle.gates[n - 1] : undefined;
    if (gate) placeGate(gate);
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') selectSlot(state.selected + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') selectSlot(state.selected - 1);
    else if (e.key === 'Backspace' || e.key === 'Delete') clearSlot();
    else if (e.key === 'Enter') run();
    else if (/^[a-d]$/i.test(e.key)) toggleInput(e.key.toUpperCase());
    else return;
    e.preventDefault();
  });
}

function renderGateRef(): void {
  $('#gate-ref').innerHTML = L.GATES.map(
    (type) =>
      `<button class="ref-row" data-info="${type}">${C.iconSvg(type)}<b>${type}</b>` +
      `<code>${E.gateNotation(type)}</code><span>${GATE_GUIDE[type].rule}</span></button>`
  ).join('');
}

applySettings();
// First-time players start with the guided warm-up instead of a wall of rules.
if (store.get<boolean>(TUTORIAL_DONE_KEY, false, isTrue)) loadDaily();
else loadTutorial();
bind();
renderGateRef();
render();
