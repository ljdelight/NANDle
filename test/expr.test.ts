import { describe, expect, it } from 'vitest';
import * as E from '../src/expr';
import * as L from '../src/logic';
import type { Bit, Gate, InputName, TopologyId } from '../src/logic';

describe('formatExpr', () => {
  it('writes a chain with the inner gate in parentheses', () => {
    const expr = E.circuitExpr(L.TOPOLOGIES.chain, ['AND', 'OR']);
    expect(E.formatExpr(expr)).toBe('(A · B) + C');
  });

  it('writes inverted gates as ¬( … ) without doubling parentheses', () => {
    const expr = E.circuitExpr(L.TOPOLOGIES.split, ['NAND', 'OR', 'XNOR']);
    expect(E.formatExpr(expr)).toBe('¬(¬(A · B) ⊕ (B + C))');
  });

  it('shows empty slots as a ? operator', () => {
    const expr = E.circuitExpr(L.TOPOLOGIES.split, ['XOR', null, null]);
    expect(E.formatExpr(expr)).toBe('(A ⊕ B) ? (B ? C)');
  });

  it('nests shared and reused inputs by topology', () => {
    const expr = E.circuitExpr(L.TOPOLOGIES.loop, ['AND', 'OR', 'XOR']);
    expect(E.formatExpr(expr)).toBe('((A · B) + C) ⊕ A');
  });
});

describe('gateNotation', () => {
  it('gives one symbol form per gate', () => {
    const notations = L.GATES.map(E.gateNotation);
    expect(notations).toEqual(['A·B', 'A+B', 'A⊕B', '¬(A·B)', '¬(A+B)', '¬(A⊕B)']);
  });
});

describe('evaluateExpr', () => {
  it.each(Object.keys(L.TOPOLOGIES) as TopologyId[])('agrees with the %s truth table', (id) => {
    const topo = L.TOPOLOGIES[id];
    const n = topo.inputs.length;
    for (let seed = 1; seed <= 10; seed++) {
      const gates: readonly Gate[] = L.generatePuzzle('Medium', id, seed).solution;
      const expr = E.circuitExpr(topo, gates);
      const table = L.truthTable(topo, gates);
      for (let r = 0; r < table.length; r++) {
        const inputs: Partial<Record<InputName, Bit>> = {};
        L.rowBits(r, n).forEach((b, i) => {
          const name = topo.inputs[i];
          if (name) inputs[name] = b;
        });
        expect(E.evaluateExpr(expr, inputs)).toBe(table[r]);
      }
    }
  });

  it('is null while a gate is empty', () => {
    const expr = E.circuitExpr(L.TOPOLOGIES.chain, ['AND', null]);
    expect(E.evaluateExpr(expr, { A: 1, B: 1, C: 0 })).toBeNull();
  });
});

describe('exprHtml', () => {
  it('tags each gate and marks the selected one', () => {
    const html = E.exprHtml(E.circuitExpr(L.TOPOLOGIES.chain, ['AND', null]), 0);
    expect(html).toContain('data-fx="0"');
    expect(html).toContain('data-fx="1"');
    expect(html).toMatch(/fx-gate selected" data-fx="0"/);
    expect(html).toContain('fx-op unknown');
  });
});
