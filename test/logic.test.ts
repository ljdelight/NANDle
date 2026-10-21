import { describe, expect, it } from 'vitest';
import * as L from '../src/logic';
import type { Bit, Difficulty, Gate, Topology, TopologyId } from '../src/logic';

describe('gates', () => {
  it('match their textbook truth tables', () => {
    const pairs: readonly [Bit, Bit][] = [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ];
    const expected: Record<Gate, Bit[]> = {
      AND: [0, 0, 0, 1],
      OR: [0, 1, 1, 1],
      XOR: [0, 1, 1, 0],
      NAND: [1, 1, 1, 0],
      NOR: [1, 0, 0, 0],
      XNOR: [1, 0, 0, 1],
    };
    for (const gate of L.GATES) {
      expect(pairs.map(([a, b]) => L.GATE_FN[gate](a, b))).toEqual(expected[gate]);
    }
  });
});

describe('truthTable', () => {
  it('evaluates a chain with A as the most significant input', () => {
    const topo: Topology = L.TOPOLOGIES.chain;
    // (A AND B) OR C
    expect(L.truthTable(topo, ['AND', 'OR'])).toEqual([0, 1, 0, 1, 0, 1, 1, 1]);
  });
});

describe('evaluatePartial', () => {
  it('computes gates whose sources are known and leaves the rest null', () => {
    const topo: Topology = L.TOPOLOGIES.split; // g0(A,B), g1(B,C), g2(g0,g1)
    const nodes = L.evaluatePartial(topo, ['AND', null, 'OR'], [1, 1, 0]);
    expect(nodes.inputs).toEqual({ A: 1, B: 1, C: 0 });
    expect(nodes.gates).toEqual([1, null, null]);
  });

  it('matches evaluateNodes for a complete circuit', () => {
    const topo: Topology = L.TOPOLOGIES.cascade;
    const gates: Gate[] = ['XOR', 'NAND', 'OR', 'AND'];
    for (let r = 0; r < 16; r++) {
      const bits = L.rowBits(r, 4);
      expect(L.rowIndex(bits)).toBe(r);
      expect(L.evaluatePartial(topo, gates, bits).gates).toEqual(L.evaluateNodes(topo, gates, bits).gates);
    }
  });
});

describe('scoreGuess', () => {
  it('scores exact matches as correct', () => {
    expect(L.scoreGuess(['AND', 'OR', 'XOR'], ['AND', 'OR', 'XOR'])).toEqual(['correct', 'correct', 'correct']);
  });

  it('marks misplaced gates present and unused gates absent', () => {
    expect(L.scoreGuess(['AND', 'OR', 'XOR'], ['OR', 'NOR', 'XOR'])).toEqual(['present', 'absent', 'correct']);
  });

  it('does not give more present marks than copies in the solution', () => {
    expect(L.scoreGuess(['AND', 'OR', 'NOR'], ['OR', 'OR', 'OR'])).toEqual(['absent', 'correct', 'absent']);
    expect(L.scoreGuess(['XOR', 'AND', 'NOR'], ['AND', 'AND', 'AND'])).toEqual(['absent', 'correct', 'absent']);
    expect(L.scoreGuess(['XOR', 'NOR', 'AND'], ['AND', 'AND', 'OR'])).toEqual(['present', 'absent', 'absent']);
  });
});

const levelTopologies: [Difficulty, TopologyId][] = L.DIFFICULTIES.flatMap((d) =>
  L.LEVELS[d].topologies.map((t): [Difficulty, TopologyId] => [d, t])
);

describe('generatePuzzle', () => {
  it.each(levelTopologies)('%s / %s puzzles use every input and are solvable', (difficulty, id) => {
    const topo = L.TOPOLOGIES[id];
    const palette = L.LEVELS[difficulty].gates;
    for (let seed = 1; seed <= 25; seed++) {
      const p = L.generatePuzzle(difficulty, id, seed);
      expect(p.difficulty).toBe(difficulty);
      expect(p.gates).toEqual(palette);
      expect(p.solution).toHaveLength(topo.gates.length);
      for (const g of p.solution) expect(palette).toContain(g);
      expect(L.truthTable(topo, p.solution)).toEqual(p.table);
      expect(L.dependsOnAllInputs(p.table, topo.inputs.length)).toBe(true);
      expect(p.solutionCount).toBeGreaterThanOrEqual(1);
      expect(L.countSolutions(topo, p.table, palette)).toBe(p.solutionCount);
    }
  });

  it('is deterministic for a seed', () => {
    expect(L.generatePuzzle('Expert', 'cascade', 42)).toEqual(L.generatePuzzle('Expert', 'cascade', 42));
  });

  it('gives the lower levels fewer gate types', () => {
    expect(L.LEVELS.Beginner.gates).toHaveLength(3);
    expect(L.LEVELS.Easy.gates).toHaveLength(4);
    expect(L.LEVELS.Medium.gates).toHaveLength(L.GATES.length);
  });

  it('counts solutions within the palette only', () => {
    const topo = L.TOPOLOGIES.chain;
    // (A AND B) XOR C is also (A NAND B) XNOR C, but only with the full palette.
    const table = L.truthTable(topo, ['AND', 'XOR']);
    expect(L.countSolutions(topo, table, L.LEVELS.Beginner.gates)).toBe(1);
    expect(L.countSolutions(topo, table, L.GATES)).toBe(2);
  });
});

describe('daily puzzles', () => {
  it('are stable for a date and numbered from 2026-01-01', () => {
    const date = new Date(2026, 9, 20);
    const a = L.dailyPuzzle(date);
    const b = L.dailyPuzzle(new Date(2026, 9, 20, 23, 59));
    expect(a).toEqual(b);
    expect(a.dateKey).toBe('2026-10-20');
    expect(L.puzzleNumber(new Date(2026, 0, 1))).toBe(1);
    expect(a.number).toBe(293);
  });

  it('follow the weekday difficulty rotation', () => {
    const monday = new Date(2026, 9, 19);
    const tuesday = new Date(2026, 9, 20);
    expect(L.dailyPuzzle(monday).difficulty).toBe('Beginner');
    expect(L.dailyPuzzle(tuesday).difficulty).toBe(L.DAILY_ROTATION[2]);
  });
});
