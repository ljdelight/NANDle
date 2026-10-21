// Boolean-expression view of a circuit: builds an expression tree from a
// topology and (possibly incomplete) gate choices, and formats it.
import { GATE_FN } from './logic';
import type { Bit, Gate, InputName, Topology } from './logic';

export type Expr =
  | { readonly kind: 'input'; readonly name: InputName }
  | {
      readonly kind: 'gate';
      /** Slot index in the topology. */
      readonly index: number;
      readonly gate: Gate | null;
      readonly left: Expr;
      readonly right: Expr;
    };

type Operator = '·' | '+' | '⊕';

const OPERATOR: Readonly<Record<Gate, Operator>> = {
  AND: '·',
  NAND: '·',
  OR: '+',
  NOR: '+',
  XOR: '⊕',
  XNOR: '⊕',
};
const NEGATED: ReadonlySet<Gate> = new Set<Gate>(['NAND', 'NOR', 'XNOR']);

/** Symbols for the gate reference, e.g. "A·B" or "¬(A·B)". */
export function gateNotation(gate: Gate): string {
  const body = `A${OPERATOR[gate]}B`;
  return NEGATED.has(gate) ? `¬(${body})` : body;
}

/** Expression tree rooted at the gate that drives Q. */
export function circuitExpr(topo: Topology, gates: readonly (Gate | null)[]): Expr {
  const nodes: Expr[] = [];
  const source = (ref: InputName | number): Expr => {
    if (typeof ref !== 'number') return { kind: 'input', name: ref };
    const node = nodes[ref];
    if (!node) throw new Error(`Gate ${ref} is used before it is defined`);
    return node;
  };
  topo.gates.forEach(([a, b], index) => {
    nodes.push({ kind: 'gate', index, gate: gates[index] ?? null, left: source(a), right: source(b) });
  });
  const root = nodes[nodes.length - 1];
  if (!root) throw new Error('Topology has no gates');
  return root;
}

/** Evaluates a complete expression; null if any gate is still empty. */
export function evaluateExpr(expr: Expr, inputs: Readonly<Partial<Record<InputName, Bit>>>): Bit | null {
  if (expr.kind === 'input') return inputs[expr.name] ?? null;
  const l = evaluateExpr(expr.left, inputs);
  const r = evaluateExpr(expr.right, inputs);
  if (expr.gate === null || l === null || r === null) return null;
  return GATE_FN[expr.gate](l, r);
}

interface Renderer {
  input(name: InputName): string;
  op(text: string, known: boolean): string;
  /** Wraps the full text of one gate's sub-expression. */
  gate(index: number, text: string): string;
}

function render(expr: Expr, out: Renderer, top: boolean): string {
  if (expr.kind === 'input') return out.input(expr.name);
  const left = render(expr.left, out, false);
  const right = render(expr.right, out, false);
  const op = expr.gate ? OPERATOR[expr.gate] : '?';
  const body = `${left} ${out.op(op, expr.gate !== null)} ${right}`;
  let text: string;
  if (expr.gate && NEGATED.has(expr.gate)) text = `${out.op('¬', true)}(${body})`;
  else text = top ? body : `(${body})`;
  return out.gate(expr.index, text);
}

/** Plain text, e.g. "¬(A · B) ⊕ (B + C)". */
export function formatExpr(expr: Expr): string {
  return render(
    expr,
    {
      input: (name) => name,
      op: (text) => text,
      gate: (_index, text) => text,
    },
    true
  );
}

/** HTML with each gate's sub-expression tagged by slot so it can be highlighted. */
export function exprHtml(expr: Expr, selected: number | null): string {
  return render(
    expr,
    {
      input: (name) => `<span class="fx-in">${name}</span>`,
      op: (text, known) => `<span class="fx-op${known ? '' : ' unknown'}">${text}</span>`,
      gate: (index, text) => `<span class="fx-gate${index === selected ? ' selected' : ''}" data-fx="${index}">${text}</span>`,
    },
    true
  );
}
