// Beginner definitions for the jargon the game uses, and markup for linking them.

export type TermId =
  | 'truth-table'
  | 'gate'
  | 'input'
  | 'output'
  | 'run'
  | 'formula'
  | 'k-map'
  | 'sop'
  | 'pos'
  | 'equivalent'
  | 'parity';

export interface Term {
  readonly name: string;
  /** Plain-language definition, as HTML. */
  readonly definition: string;
}

export const GLOSSARY: Readonly<Record<TermId, Term>> = {
  'truth-table': {
    name: 'Truth table',
    definition:
      'A list of every combination of the inputs, with the output <b>Q</b> for each. ' +
      'Each column is one combination, and your goal is to match the Q row in every column.',
  },
  gate: {
    name: 'Gate',
    definition:
      'A tiny decision-maker. It takes two inputs, each 0 or 1, and outputs a 0 or 1 by a fixed rule, such as AND or OR.',
  },
  input: {
    name: 'Input',
    definition: 'A switch feeding the circuit: A, B, C or D. Each one is either <b>1</b> (on) or <b>0</b> (off).',
  },
  output: {
    name: 'Output (Q)',
    definition: "<b>Q</b> is the circuit's answer: the signal coming out of the last gate.",
  },
  run: {
    name: 'Run',
    definition: 'One test of your circuit against the whole truth table. You get 6 runs per puzzle.',
  },
  formula: {
    name: 'Formula',
    definition:
      'Your circuit written in Boolean algebra: <b>·</b> means AND, <b>+</b> means OR, <b>⊕</b> means XOR and ' +
      '<b>¬</b> means NOT. Parentheses show which gate feeds which.',
  },
  'k-map': {
    name: 'K-map',
    definition:
      'Short for <b>Karnaugh map</b>: the truth table rearranged into a grid where neighboring cells differ by ' +
      'just one input. Blocks of matching neighbors simplify into short terms.',
  },
  sop: {
    name: 'Sum of products (SOP)',
    definition:
      'An OR of AND terms, like <code>AB + C</code>: "A and B, or C". Grouping the 1s on a K-map finds the shortest one.',
  },
  pos: {
    name: 'Product of sums (POS)',
    definition:
      'An AND of OR terms, like <code>(A + C)(B + C)</code>: "A or C, and B or C". Grouping the 0s on a K-map finds the shortest one.',
  },
  equivalent: {
    name: 'Equivalent circuits',
    definition:
      'Different circuits can produce exactly the same truth table, so a puzzle can have more than one answer. ' +
      'Any of them wins, but tile colors compare against one hidden circuit.',
  },
  parity: {
    name: 'Parity',
    definition:
      'Whether an odd number of inputs are 1. Chains of XOR gates compute it, and on a K-map it shows up as a checkerboard.',
  },
};

/** Order for the full glossary list. */
export const TERM_ORDER: readonly TermId[] = [
  'input',
  'gate',
  'output',
  'truth-table',
  'run',
  'formula',
  'equivalent',
  'k-map',
  'sop',
  'pos',
  'parity',
];

export function isTermId(v: unknown): v is TermId {
  return typeof v === 'string' && v in GLOSSARY;
}

/** A tappable, dotted-underlined term; `text` defaults to the term's name. */
export function termHtml(id: TermId, text: string = GLOSSARY[id].name): string {
  return `<button type="button" class="gloss" data-term="${id}" aria-haspopup="dialog">${text}</button>`;
}
