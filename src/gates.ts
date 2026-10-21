// Beginner-facing descriptions of each gate, for tooltips and the gate card.
import { GATE_FN } from './logic';
import type { Bit, Gate } from './logic';

export interface GateGuide {
  /** One-line rule, e.g. "1 only when both inputs are 1". */
  readonly rule: string;
  /** Everyday picture of the gate, as HTML. */
  readonly analogy: string;
  /** Optional extra, as HTML. */
  readonly note: string | null;
  /** A full phrase on how to say the name, as HTML; null when it reads as written. */
  readonly say: string | null;
}

export const GATE_GUIDE: Readonly<Record<Gate, GateGuide>> = {
  AND: {
    rule: '1 only when both inputs are 1',
    analogy: 'Two light switches <b>in a row</b> on one wire: the lamp lights only if <i>both</i> are on.',
    note: null,
    say: null,
  },
  OR: {
    rule: '1 when either input is 1',
    analogy: 'Two light switches <b>side by side</b>: <i>either</i> one (or both) lights the lamp.',
    note: null,
    say: null,
  },
  XOR: {
    rule: '1 when the inputs differ',
    analogy:
      'A stair light with a switch at the top and bottom: flipping <i>either</i> switch changes the light. ' +
      'It is on when the switches disagree.',
    note: 'Short for <b>exclusive OR</b>: one or the other, but not both.',
    say: 'say “ex-or” (some say “zor”)',
  },
  NAND: {
    rule: 'NOT AND: 0 only when both inputs are 1',
    analogy: 'An AND gate with its answer flipped. The little circle on the output means <b>NOT</b>.',
    note: 'Any circuit at all can be built from NAND gates alone, which is where Nandle gets its name.',
    say: 'rhymes with <i>hand</i>',
  },
  NOR: {
    rule: 'NOT OR: 1 only when both inputs are 0',
    analogy: 'An OR gate with its answer flipped: the lamp is on only when <i>neither</i> switch is on.',
    note: 'Like NAND, NOR alone can build any circuit.',
    say: 'said as in <i>neither… nor</i>',
  },
  XNOR: {
    rule: 'NOT XOR: 1 when the inputs match',
    analogy: 'An XOR gate with its answer flipped, so it works as a <b>sameness detector</b>: 1 when A equals B.',
    note: null,
    say: 'say “ex-nor”',
  },
};

export interface GateRow {
  readonly a: Bit;
  readonly b: Bit;
  readonly out: Bit;
}

/** The gate's own four-row truth table, in A-then-B binary order. */
export function gateTable(gate: Gate): GateRow[] {
  const bits: readonly Bit[] = [0, 1];
  return bits.flatMap((a) => bits.map((b): GateRow => ({ a, b, out: GATE_FN[gate](a, b) })));
}
