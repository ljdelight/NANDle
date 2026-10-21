import { describe, expect, it } from 'vitest';
import * as K from '../src/kmap';
import type { Form } from '../src/kmap';
import * as L from '../src/logic';
import type { Bit, InputName, TopologyId } from '../src/logic';

const ABC: readonly InputName[] = ['A', 'B', 'C'];
const ABCD: readonly InputName[] = ['A', 'B', 'C', 'D'];

/** Evaluates a minimized expression back into a truth table. */
function expand(groups: readonly K.Implicant[], n: number, form: Form): Bit[] {
  const out: Bit[] = [];
  for (let m = 0; m < 1 << n; m++) {
    const hit = groups.some((g) => K.covers(g, m));
    out.push((form === 'sop' ? (hit ? 1 : 0) : hit ? 0 : 1) as Bit);
  }
  return out;
}

describe('kmapLayout', () => {
  it('puts A on rows and BC on Gray-coded columns for 3 inputs', () => {
    const layout = K.kmapLayout(ABC);
    expect(layout.rowVars).toEqual(['A']);
    expect(layout.colVars).toEqual(['B', 'C']);
    expect(K.cellMinterm(layout, 0, 2)).toBe(0b011);
    expect(K.cellMinterm(layout, 1, 3)).toBe(0b110);
  });

  it('Gray-codes both axes for 4 inputs', () => {
    const layout = K.kmapLayout(ABCD);
    expect(K.cellMinterm(layout, 2, 2)).toBe(0b1111);
    expect(K.cellMinterm(layout, 3, 0)).toBe(0b1000);
  });
});

describe('minimize', () => {
  // (A AND B) OR C
  const table: Bit[] = [0, 1, 0, 1, 0, 1, 1, 1];

  it('finds the minimal sum of products', () => {
    expect(K.formatExpression(K.minimize(table, 3, 'sop'), ABC, 'sop')).toBe('C + AB');
  });

  it('finds the minimal product of sums', () => {
    expect(K.formatExpression(K.minimize(table, 3, 'pos'), ABC, 'pos')).toBe('(A + C)(B + C)');
  });

  it('groups across the wrap-around edge', () => {
    // 1 wherever D = 0: one group spanning the left and right columns.
    const evenD: Bit[] = Array.from({ length: 16 }, (_, m): Bit => ((m & 1) === 0 ? 1 : 0));
    expect(K.formatExpression(K.minimize(evenD, 4, 'sop'), ABCD, 'sop')).toBe("D'");
  });

  it('handles constants', () => {
    expect(K.formatExpression(K.minimize([0, 0, 0, 0, 0, 0, 0, 0], 3, 'sop'), ABC, 'sop')).toBe('0');
    expect(K.formatExpression(K.minimize([1, 1, 1, 1, 1, 1, 1, 1], 3, 'sop'), ABC, 'sop')).toBe('1');
    expect(K.formatExpression(K.minimize([1, 1, 1, 1, 1, 1, 1, 1], 3, 'pos'), ABC, 'pos')).toBe('1');
  });

  it.each(Object.keys(L.TOPOLOGIES) as TopologyId[])('reproduces every %s puzzle table', (id) => {
    const topo = L.TOPOLOGIES[id];
    const n = topo.inputs.length;
    for (let seed = 1; seed <= 20; seed++) {
      const { table } = L.generatePuzzle('Medium', id, seed);
      for (const form of ['sop', 'pos'] as const) {
        const groups = K.minimize(table, n, form);
        expect(expand(groups, n, form)).toEqual(table);
        // Minimal covers only ever use prime implicants.
        const want: Bit = form === 'sop' ? 1 : 0;
        const minterms = table.flatMap((v, m) => (v === want ? [m] : []));
        const primes = K.primeImplicants(minterms, n);
        for (const g of groups) expect(primes).toContainEqual(g);
      }
    }
  });
});

describe('parityHint', () => {
  it('spots a full XOR checkerboard', () => {
    const xor3: Bit[] = [0, 1, 1, 0, 1, 0, 0, 1];
    expect(K.parityHint(xor3, ABC)).toEqual({ vars: ['A', 'B', 'C'], inverted: false });
  });

  it('spots XNOR', () => {
    const xnor3: Bit[] = [1, 0, 0, 1, 0, 1, 1, 0];
    expect(K.parityHint(xnor3, ABC)).toEqual({ vars: ['A', 'B', 'C'], inverted: true });
  });

  it('returns null for non-parity functions', () => {
    expect(K.parityHint([0, 1, 0, 1, 0, 1, 1, 1], ABC)).toBeNull();
  });
});
