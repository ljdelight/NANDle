import { describe, expect, it } from 'vitest';
import * as L from '../src/logic';
import * as T from '../src/tutorial';
import type { StepId, TutorialEvent } from '../src/tutorial';

const play = (events: readonly TutorialEvent[]): StepId =>
  events.reduce((s: StepId, e: TutorialEvent): StepId => T.advance(s, e), 'welcome');

describe('tutorial flow', () => {
  it('walks through a wrong first try and then a solve', () => {
    const path: StepId[] = [];
    let s: StepId = 'welcome';
    const events: TutorialEvent[] = [
      { kind: 'next' },
      { kind: 'toggle', input: 'A', value: 1 },
      { kind: 'next' },
      { kind: 'place', gate: 'OR' },
      { kind: 'run', won: false },
      { kind: 'next' },
      { kind: 'place', gate: 'AND' },
      { kind: 'run', won: true },
    ];
    for (const e of events) {
      s = T.advance(s, e);
      path.push(s);
    }
    expect(path).toEqual(['toggle', 'table', 'place', 'run', 'feedback', 'retry', 'retry', 'done']);
  });

  it('waits for A to be switched on, not B or off', () => {
    expect(T.advance('toggle', { kind: 'toggle', input: 'B', value: 1 })).toBe('toggle');
    expect(T.advance('toggle', { kind: 'toggle', input: 'A', value: 0 })).toBe('toggle');
  });

  it('jumps to done on a winning run from any step', () => {
    for (const s of T.STEP_ORDER) expect(T.advance(s, { kind: 'run', won: true })).toBe('done');
  });

  it('stays on retry after another miss', () => {
    expect(play([{ kind: 'next' }, { kind: 'run', won: false }, { kind: 'next' }, { kind: 'run', won: false }])).toBe('retry');
  });

  it('ignores Next on action steps', () => {
    for (const s of ['toggle', 'place', 'run', 'retry', 'done'] as const) {
      expect(T.advance(s, { kind: 'next' })).toBe(s);
    }
  });

  it('only offers Next on steps that wait for it', () => {
    const ctx: T.RunContext = { gate: 'OR', matched: 2, rows: 4 };
    for (const s of T.STEP_ORDER) {
      expect(T.step(s, ctx).next).toBe(T.advance(s, { kind: 'next' }) !== s);
    }
  });

  it('describes the latest run in the feedback step', () => {
    const body = T.step('feedback', { gate: 'OR', matched: 2, rows: 4 }).body;
    expect(body).toContain('OR matched <b>2 of 4</b>');
  });
});

describe('tutorialPuzzle', () => {
  it('is a single AND gate with a beginner palette', () => {
    const p = L.tutorialPuzzle();
    expect(p.topoId).toBe('single');
    expect(p.solution).toEqual(['AND']);
    expect(p.table).toEqual([0, 0, 0, 1]);
    expect(p.solutionCount).toBe(1);
    expect(p.gates).toContain('OR');
  });

  it('makes OR a 2-of-4 miss, so the first suggested try shows feedback', () => {
    const p = L.tutorialPuzzle();
    const or = L.truthTable(L.TOPOLOGIES.single, ['OR']);
    expect(L.matchingRows(p.table, or)).toBe(2);
  });
});
