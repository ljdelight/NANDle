// Karnaugh-map helpers: Gray-code layout, Quine–McCluskey minimization and a
// parity (XOR checkerboard) detector. Pure logic, no DOM.
import type { Bit, InputName } from './logic';

/** A product (or sum) term: variables whose bit is set in `mask` are eliminated. */
export interface Implicant {
  /** Values of the variables that remain, as minterm bits (A is the MSB). */
  readonly bits: number;
  readonly mask: number;
}

export type Form = 'sop' | 'pos';

export interface KMapLayout {
  readonly rowVars: readonly InputName[];
  readonly colVars: readonly InputName[];
  /** Gray-code values of the row variables, top to bottom. */
  readonly rowCodes: readonly number[];
  /** Gray-code values of the column variables, left to right. */
  readonly colCodes: readonly number[];
}

export interface Literal {
  readonly name: InputName;
  readonly negated: boolean;
}

export interface ParityHint {
  readonly vars: readonly InputName[];
  /** True when the function is XNOR-like (parity inverted). */
  readonly inverted: boolean;
}

const GRAY: Readonly<Record<number, readonly number[]>> = {
  1: [0, 1],
  2: [0b00, 0b01, 0b11, 0b10],
};

function gray(bits: number): readonly number[] {
  const codes = GRAY[bits];
  if (!codes) throw new RangeError(`No Gray code for ${bits} bits`);
  return codes;
}

/** Row variables take the high bits, column variables the low bits. */
export function kmapLayout(inputs: readonly InputName[]): KMapLayout {
  const rowCount = Math.floor(inputs.length / 2);
  const rowVars = inputs.slice(0, rowCount);
  const colVars = inputs.slice(rowCount);
  return { rowVars, colVars, rowCodes: gray(rowVars.length), colCodes: gray(colVars.length) };
}

export function cellMinterm(layout: KMapLayout, row: number, col: number): number {
  const r = layout.rowCodes[row];
  const c = layout.colCodes[col];
  if (r === undefined || c === undefined) throw new RangeError(`Cell ${row},${col} is outside the map`);
  return (r << layout.colVars.length) | c;
}

export function covers(imp: Implicant, minterm: number): boolean {
  return (minterm & ~imp.mask) === imp.bits;
}

function popcount(x: number): number {
  let n = 0;
  for (let v = x; v; v &= v - 1) n++;
  return n;
}

export function literalCount(imp: Implicant, n: number): number {
  return n - popcount(imp.mask);
}

export function primeImplicants(minterms: readonly number[], n: number): Implicant[] {
  const keyOf = (imp: Implicant): string => `${imp.bits}/${imp.mask}`;
  let current = new Map<string, Implicant>();
  for (const m of minterms) current.set(keyOf({ bits: m, mask: 0 }), { bits: m, mask: 0 });
  const primes = new Map<string, Implicant>();
  for (let size = 0; size <= n && current.size > 0; size++) {
    const next = new Map<string, Implicant>();
    const merged = new Set<string>();
    const list = [...current.values()];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (!a || !b || a.mask !== b.mask) continue;
        const diff = a.bits ^ b.bits;
        if (popcount(diff) !== 1) continue;
        const combined: Implicant = { bits: a.bits & ~diff, mask: a.mask | diff };
        next.set(keyOf(combined), combined);
        merged.add(keyOf(a));
        merged.add(keyOf(b));
      }
    }
    for (const [key, imp] of current) if (!merged.has(key)) primes.set(key, imp);
    current = next;
  }
  return [...primes.values()];
}

/** Smallest set of primes covering every minterm (fewest terms, then fewest literals). */
export function minimalCover(minterms: readonly number[], primes: readonly Implicant[], n: number): Implicant[] {
  const cost = (set: readonly Implicant[]): number =>
    set.reduce((sum: number, p: Implicant): number => sum + 100 + literalCount(p, n), 0);
  let best: Implicant[] | null = null;

  const search = (uncovered: readonly number[], chosen: readonly Implicant[]): void => {
    if (best && cost(chosen) >= cost(best)) return;
    if (uncovered.length === 0) {
      best = [...chosen];
      return;
    }
    // Branch on the minterm with the fewest covering primes.
    let options: Implicant[] | null = null;
    for (const m of uncovered) {
      const opts = primes.filter((p) => covers(p, m));
      if (!options || opts.length < options.length) options = opts;
    }
    for (const p of options ?? []) {
      search(
        uncovered.filter((m) => !covers(p, m)),
        [...chosen, p]
      );
    }
  };

  search(minterms, []);
  return best ?? [];
}

/**
 * Minimal groups for a truth table. `sop` groups the 1s (sum of products);
 * `pos` groups the 0s (product of sums). Largest groups come first.
 */
export function minimize(table: readonly Bit[], n: number, form: Form): Implicant[] {
  const want: Bit = form === 'sop' ? 1 : 0;
  const minterms = table.flatMap((v: Bit, m: number): number[] => (v === want ? [m] : []));
  const cover = minimalCover(minterms, primeImplicants(minterms, n), n);
  return cover.sort((a, b) => popcount(b.mask) - popcount(a.mask) || a.bits - b.bits);
}

/**
 * Literals of a group. A product term complements variables fixed at 0; a sum
 * term (POS, grouping zeros) complements variables fixed at 1.
 */
export function literals(imp: Implicant, inputs: readonly InputName[], form: Form): Literal[] {
  const n = inputs.length;
  const out: Literal[] = [];
  inputs.forEach((name, i) => {
    const bit = 1 << (n - 1 - i);
    if (imp.mask & bit) return;
    const isOne = (imp.bits & bit) !== 0;
    out.push({ name, negated: form === 'sop' ? !isOne : isOne });
  });
  return out;
}

const literalText = (l: Literal): string => (l.negated ? `${l.name}'` : l.name);

/** Plain-text expression, e.g. "AB' + C" or "(A + C)(B' + C)". */
export function formatExpression(groups: readonly Implicant[], inputs: readonly InputName[], form: Form): string {
  if (form === 'sop') {
    if (groups.length === 0) return '0';
    return groups
      .map((g) => {
        const lits = literals(g, inputs, form);
        return lits.length ? lits.map(literalText).join('') : '1';
      })
      .join(' + ');
  }
  if (groups.length === 0) return '1';
  const sums = groups.map((g) => literals(g, inputs, form).map(literalText));
  if (sums.some((s) => s.length === 0)) return '0';
  if (sums.length === 1 && sums[0]?.length === 1) return sums[0][0] ?? '';
  return sums.map((s) => (s.length === 1 ? (s[0] ?? '') : `(${s.join(' + ')})`)).join('');
}

/** Detects functions that are exactly the XOR (or XNOR) of some inputs. */
export function parityHint(table: readonly Bit[], inputs: readonly InputName[]): ParityHint | null {
  const n = inputs.length;
  for (let subset = 1; subset < 1 << n; subset++) {
    const first = table[0];
    let isParity = true;
    for (let m = 0; m < table.length && isParity; m++) {
      const parity = popcount(m & subset) & 1;
      if ((table[m] ?? 0) !== ((parity ^ (first ?? 0)) as Bit)) isParity = false;
    }
    if (isParity) {
      const vars = inputs.filter((_, i) => subset & (1 << (n - 1 - i)));
      return { vars, inverted: first === 1 };
    }
  }
  return null;
}
