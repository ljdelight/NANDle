// Core puzzle logic: gates, circuit topologies, truth tables, puzzle generation
// and Wordle-style scoring. No DOM access, so it runs in the browser and in tests.

export const GATES = ['AND', 'OR', 'XOR', 'NAND', 'NOR', 'XNOR'] as const;
export type Gate = (typeof GATES)[number];

export type Bit = 0 | 1;
export type InputName = 'A' | 'B' | 'C' | 'D';
/** A gate source: a circuit input by name, or an earlier gate by index. */
export type SourceRef = InputName | number;
export type Score = 'correct' | 'present' | 'absent';

export type TopologyId = 'single' | 'chain' | 'split' | 'loop' | 'quad' | 'cascade';
export type Difficulty = 'Beginner' | 'Easy' | 'Medium' | 'Hard' | 'Expert';

export interface Topology {
  readonly id: TopologyId;
  readonly inputs: readonly InputName[];
  /** Two sources per gate; the last gate drives the output. */
  readonly gates: readonly (readonly [SourceRef, SourceRef])[];
}

export interface Level {
  readonly topologies: readonly TopologyId[];
  /** Gate types the player may choose from. */
  readonly gates: readonly Gate[];
}

export interface Puzzle {
  readonly difficulty: Difficulty;
  readonly topoId: TopologyId;
  /** Gate types the player may choose from. */
  readonly gates: readonly Gate[];
  readonly solution: readonly Gate[];
  /** Output column of the truth table; row r encodes inputs with A as the MSB. */
  readonly table: readonly Bit[];
  /** How many gate assignments produce this table (any of them wins). */
  readonly solutionCount: number;
  readonly seed: number;
}

export interface DailyPuzzle extends Puzzle {
  readonly dateKey: string;
  readonly number: number;
}

export interface NodeValues {
  readonly inputs: Readonly<Partial<Record<InputName, Bit>>>;
  readonly gates: readonly Bit[];
}

export const GATE_FN: Readonly<Record<Gate, (a: Bit, b: Bit) => Bit>> = {
  AND: (a, b) => (a & b) as Bit,
  OR: (a, b) => (a | b) as Bit,
  XOR: (a, b) => (a ^ b) as Bit,
  NAND: (a, b) => (1 - (a & b)) as Bit,
  NOR: (a, b) => (1 - (a | b)) as Bit,
  XNOR: (a, b) => (1 - (a ^ b)) as Bit,
};

export const TOPOLOGIES: Readonly<Record<TopologyId, Topology>> = {
  /** Used only by the tutorial. */
  single: { id: 'single', inputs: ['A', 'B'], gates: [['A', 'B']] },
  chain: { id: 'chain', inputs: ['A', 'B', 'C'], gates: [['A', 'B'], [0, 'C']] },
  split: { id: 'split', inputs: ['A', 'B', 'C'], gates: [['A', 'B'], ['B', 'C'], [0, 1]] },
  loop: { id: 'loop', inputs: ['A', 'B', 'C'], gates: [['A', 'B'], [0, 'C'], [1, 'A']] },
  quad: { id: 'quad', inputs: ['A', 'B', 'C', 'D'], gates: [['A', 'B'], ['C', 'D'], [0, 1]] },
  cascade: {
    id: 'cascade',
    inputs: ['A', 'B', 'C', 'D'],
    gates: [['A', 'B'], ['B', 'C'], [1, 'D'], [0, 2]],
  },
};

export const LEVELS: Readonly<Record<Difficulty, Level>> = {
  Beginner: { topologies: ['chain'], gates: ['AND', 'OR', 'XOR'] },
  Easy: { topologies: ['chain'], gates: ['AND', 'OR', 'NAND', 'NOR'] },
  Medium: { topologies: ['split', 'loop'], gates: GATES },
  Hard: { topologies: ['quad'], gates: GATES },
  Expert: { topologies: ['cascade'], gates: GATES },
};

export const DIFFICULTIES: readonly Difficulty[] = ['Beginner', 'Easy', 'Medium', 'Hard', 'Expert'];

/** Indexed by Date#getDay(): Sunday first. Puzzles ramp up through the week. */
export const DAILY_ROTATION: readonly Difficulty[] = ['Hard', 'Beginner', 'Easy', 'Medium', 'Medium', 'Hard', 'Expert'];

const EPOCH: number = Date.UTC(2026, 0, 1);

/** Indexes a list that is known to be long enough; throws instead of yielding undefined. */
function at<T>(list: readonly T[], index: number): T {
  const value = list[index];
  if (value === undefined) throw new RangeError(`Index ${index} out of range`);
  return value;
}

export function evaluateNodes(topo: Topology, gates: readonly Gate[], bits: readonly Bit[]): NodeValues {
  const inputs: Partial<Record<InputName, Bit>> = {};
  topo.inputs.forEach((name, i) => (inputs[name] = at(bits, i)));
  const outs: Bit[] = [];
  const read = (ref: SourceRef): Bit => {
    const value = typeof ref === 'number' ? outs[ref] : inputs[ref];
    if (value === undefined) throw new Error(`Unresolved source ${String(ref)}`);
    return value;
  };
  topo.gates.forEach(([a, b], g) => {
    outs[g] = GATE_FN[at(gates, g)](read(a), read(b));
  });
  return { inputs, gates: outs };
}

export interface PartialNodeValues {
  readonly inputs: Readonly<Partial<Record<InputName, Bit>>>;
  /** Null where a gate is unfilled or depends on an unfilled gate. */
  readonly gates: readonly (Bit | null)[];
}

/** Like evaluateNodes, but tolerates empty slots in a circuit still being built. */
export function evaluatePartial(
  topo: Topology,
  gates: readonly (Gate | null)[],
  bits: readonly Bit[]
): PartialNodeValues {
  const inputs: Partial<Record<InputName, Bit>> = {};
  topo.inputs.forEach((name, i) => (inputs[name] = at(bits, i)));
  const outs: (Bit | null)[] = [];
  const read = (ref: SourceRef): Bit | null => (typeof ref === 'number' ? (outs[ref] ?? null) : (inputs[ref] ?? null));
  topo.gates.forEach(([a, b], g) => {
    const type = gates[g] ?? null;
    const va = read(a);
    const vb = read(b);
    outs[g] = type === null || va === null || vb === null ? null : GATE_FN[type](va, vb);
  });
  return { inputs, gates: outs };
}

/** Truth-table row index for input bits (A is the MSB). */
export function rowIndex(bits: readonly Bit[]): number {
  return bits.reduce((row: number, b: Bit): number => (row << 1) | b, 0);
}

export function rowBits(row: number, n: number): Bit[] {
  const bits: Bit[] = [];
  for (let i = 0; i < n; i++) bits.push(((row >> (n - 1 - i)) & 1) as Bit);
  return bits;
}

export function truthTable(topo: Topology, gates: readonly Gate[]): Bit[] {
  const n = topo.inputs.length;
  const out: Bit[] = [];
  for (let r = 0; r < 1 << n; r++) {
    const nodes = evaluateNodes(topo, gates, rowBits(r, n));
    out.push(at(nodes.gates, nodes.gates.length - 1));
  }
  return out;
}

export function dependsOnAllInputs(table: readonly Bit[], n: number): boolean {
  for (let i = 0; i < n; i++) {
    const mask = 1 << (n - 1 - i);
    let matters = false;
    for (let r = 0; r < table.length && !matters; r++) {
      if (table[r] !== table[r ^ mask]) matters = true;
    }
    if (!matters) return false;
  }
  return true;
}

function allAssignments(count: number, palette: readonly Gate[]): Gate[][] {
  const result: Gate[][] = [];
  const total = Math.pow(palette.length, count);
  for (let k = 0; k < total; k++) {
    const assignment: Gate[] = [];
    let rest = k;
    for (let i = 0; i < count; i++) {
      assignment.push(at(palette, rest % palette.length));
      rest = Math.floor(rest / palette.length);
    }
    result.push(assignment);
  }
  return result;
}

const tableKey = (table: readonly Bit[]): string => table.join('');

/** Per topology and palette: truth-table key -> number of gate assignments producing it. */
const solutionIndexCache = new Map<string, Map<string, number>>();

function solutionIndex(topo: Topology, palette: readonly Gate[]): Map<string, number> {
  const cacheKey = `${topo.id}:${palette.join(',')}`;
  const cached = solutionIndexCache.get(cacheKey);
  if (cached) return cached;
  const index = new Map<string, number>();
  for (const assignment of allAssignments(topo.gates.length, palette)) {
    const key = tableKey(truthTable(topo, assignment));
    index.set(key, (index.get(key) ?? 0) + 1);
  }
  solutionIndexCache.set(cacheKey, index);
  return index;
}

/** How many circuits built from `palette` produce `table`. */
export function countSolutions(topo: Topology, table: readonly Bit[], palette: readonly Gate[]): number {
  return solutionIndex(topo, palette).get(tableKey(table)) ?? 0;
}

export type Rng = () => number;

function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Picks a random circuit whose output uses every input and that as few other
 * circuits can imitate as possible. Any circuit matching the table wins.
 */
export function generatePuzzle(difficulty: Difficulty, topoId: TopologyId, seed: number): Puzzle {
  const topo = TOPOLOGIES[topoId];
  const gates = LEVELS[difficulty].gates;
  const rng = mulberry32(seed);
  let best: Puzzle | null = null;
  for (let attempt = 0; attempt < 400; attempt++) {
    const solution: Gate[] = topo.gates.map((): Gate => at(gates, Math.floor(rng() * gates.length)));
    const table = truthTable(topo, solution);
    if (!dependsOnAllInputs(table, topo.inputs.length)) continue;
    const count = countSolutions(topo, table, gates);
    if (!best || count < best.solutionCount) {
      best = { difficulty, topoId, gates, solution, table, solutionCount: count, seed };
    }
    if (count <= 2) break;
  }
  if (!best) throw new Error(`Could not generate a puzzle for ${topoId}`);
  return best;
}

/**
 * Wordle rules: correct = right gate in the right slot, present = gate is used
 * in another slot (respecting how many times it appears), absent = not used.
 */
export function scoreGuess(solution: readonly Gate[], guess: readonly Gate[]): Score[] {
  const result: (Score | null)[] = guess.map((g, i): Score | null => (g === solution[i] ? 'correct' : null));
  const remaining = new Map<Gate, number>();
  solution.forEach((g, i) => {
    if (result[i] !== 'correct') remaining.set(g, (remaining.get(g) ?? 0) + 1);
  });
  return guess.map((g, i): Score => {
    const known = result[i];
    if (known) return known;
    const left = remaining.get(g) ?? 0;
    if (left > 0) {
      remaining.set(g, left - 1);
      return 'present';
    }
    return 'absent';
  });
}

export function matchingRows(target: readonly Bit[], table: readonly Bit[]): number {
  return table.reduce((n: number, v: Bit, i: number): number => n + (v === target[i] ? 1 : 0), 0);
}

export function dateKey(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function puzzleNumber(date: Date): number {
  const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((day - EPOCH) / 86400000) + 1;
}

export function dailyPuzzle(date: Date): DailyPuzzle {
  const key = dateKey(date);
  const seed = hashString('nandle:' + key);
  const difficulty = at(DAILY_ROTATION, date.getDay());
  const ids = LEVELS[difficulty].topologies;
  const puzzle = generatePuzzle(difficulty, at(ids, seed % ids.length), seed);
  return { ...puzzle, dateKey: key, number: puzzleNumber(date) };
}

/** The tutorial's warm-up: one AND gate, solved after a suggested wrong try with OR. */
export function tutorialPuzzle(): Puzzle {
  const topo = TOPOLOGIES.single;
  const gates = LEVELS.Beginner.gates;
  const solution: Gate[] = ['AND'];
  const table = truthTable(topo, solution);
  return {
    difficulty: 'Beginner',
    topoId: topo.id,
    gates,
    solution,
    table,
    solutionCount: countSolutions(topo, table, gates),
    seed: 0,
  };
}

export function practicePuzzle(difficulty: Difficulty, seed: number): Puzzle {
  const ids = LEVELS[difficulty].topologies;
  return generatePuzzle(difficulty, at(ids, seed % ids.length), hashString('practice:' + seed));
}

export function isGate(value: unknown): value is Gate {
  return typeof value === 'string' && (GATES as readonly string[]).includes(value);
}
