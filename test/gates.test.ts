import { describe, expect, it } from 'vitest';
import { GATE_GUIDE, gateTable } from '../src/gates';
import * as L from '../src/logic';

describe('gateTable', () => {
  it('lists the four input pairs in binary order', () => {
    expect(gateTable('AND').map((r) => `${r.a}${r.b}`)).toEqual(['00', '01', '10', '11']);
  });

  it('matches each gate function', () => {
    for (const gate of L.GATES) {
      for (const row of gateTable(gate)) expect(row.out).toBe(L.GATE_FN[gate](row.a, row.b));
    }
  });

  it('gives XOR its defining outputs', () => {
    expect(gateTable('XOR').map((r) => r.out)).toEqual([0, 1, 1, 0]);
  });
});

describe('GATE_GUIDE', () => {
  it('describes every gate', () => {
    for (const gate of L.GATES) {
      expect(GATE_GUIDE[gate].rule.length).toBeGreaterThan(0);
      expect(GATE_GUIDE[gate].analogy.length).toBeGreaterThan(0);
    }
  });

  it('gives pronunciation hints only for names that need them', () => {
    const hinted = L.GATES.filter((g) => GATE_GUIDE[g].say !== null);
    expect(hinted).toEqual(['XOR', 'NAND', 'NOR', 'XNOR']);
  });
});
