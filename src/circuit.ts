// SVG schematic rendering for a circuit topology. Builds markup strings; the
// caller wires up events through data-slot / data-input attributes.
import type { Bit, Gate, InputName, Topology } from './logic';

const GW = 64; // gate box width
const GH = 48; // gate box height
const PIN = 12; // pin offset from gate centre
const PAD_T = 30;
const WIRE_X = 52; // where input wires start

/** Spacing that differs between the roomy and the narrow-screen layouts. */
interface Metrics {
  /** Horizontal distance between gate levels. */
  readonly col: number;
  /** Vertical spacing of circuit inputs. */
  readonly row: number;
  readonly firstGateX: number;
  /** Gap between the last gate and the Q terminal. */
  readonly outGap: number;
}

const ROOMY: Metrics = { col: 130, row: 76, firstGateX: 112, outGap: 44 };
const COMPACT: Metrics = { col: 98, row: 72, firstGateX: 100, outGap: 30 };

/** Key of a signal source: an input name ('A') or a gate ('g0'). */
export type SourceKey = InputName | `g${number}`;
export type SignalValues = Partial<Record<SourceKey, Bit>>;

interface Shape {
  readonly body: string;
  /** Where input pins meet the body. */
  readonly left: number;
  /** Rightmost point of the body, before any inversion bubble. */
  readonly tip: number;
}

type BaseShape = 'AND' | 'OR';

// Gate bodies are drawn in a 64x48 box.
const SHAPES: Readonly<Record<BaseShape, Shape>> = {
  AND: { body: 'M6 2 H30 A22 22 0 0 1 30 46 H6 Z', left: 6, tip: 52 },
  OR: { body: 'M6 2 Q20 24 6 46 Q38 46 54 24 Q38 2 6 2 Z', left: 11, tip: 54 },
};
const BASE: Readonly<Record<Gate, BaseShape>> = { AND: 'AND', NAND: 'AND', OR: 'OR', NOR: 'OR', XOR: 'OR', XNOR: 'OR' };
const INVERTED: ReadonlySet<Gate> = new Set<Gate>(['NAND', 'NOR', 'XNOR']);
const EXCLUSIVE: ReadonlySet<Gate> = new Set<Gate>(['XOR', 'XNOR']);

function gateSymbol(type: Gate, withLabel: boolean): string {
  const shape = SHAPES[BASE[type]];
  let out = `<path class="gate-body" d="${shape.body}"/>`;
  if (EXCLUSIVE.has(type)) out += `<path class="gate-line" d="M0 2 Q14 24 0 46"/>`;
  let end = shape.tip;
  if (INVERTED.has(type)) {
    out += `<circle class="gate-body" cx="${shape.tip + 4}" cy="24" r="4"/>`;
    end = shape.tip + 8;
  }
  out += `<path class="gate-line" d="M0 ${24 - PIN} H${shape.left} M0 ${24 + PIN} H${shape.left} M${end} 24 H${GW}"/>`;
  if (withLabel) {
    const cx = BASE[type] === 'AND' ? 26 : 28;
    out += `<text class="gate-label" x="${cx}" y="28" text-anchor="middle">${type}</text>`;
  }
  return out;
}

export function iconSvg(type: Gate): string {
  return `<svg class="gate-icon" viewBox="-2 0 68 48" aria-hidden="true">${gateSymbol(type, false)}</svg>`;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

interface PlacedGate {
  readonly index: number;
  readonly level: number;
  readonly x: number;
  readonly cy: number;
  /** Sources ordered top to bottom, matching pin 0 and pin 1. */
  readonly inputs: readonly SourceKey[];
}

interface Layout {
  readonly sources: ReadonlyMap<SourceKey, Point>;
  readonly gates: readonly PlacedGate[];
  readonly out: Point;
  readonly width: number;
  readonly height: number;
}

const gateKey = (index: number): SourceKey => `g${index}`;

function point(map: ReadonlyMap<SourceKey, Point>, key: SourceKey): Point {
  const p = map.get(key);
  if (!p) throw new Error(`No position for ${key}`);
  return p;
}

export function layout(topo: Topology, compact: boolean): Layout {
  const { col, row, firstGateX, outGap }: Metrics = compact ? COMPACT : ROOMY;
  const sources = new Map<SourceKey, Point>();
  topo.inputs.forEach((name, i) => sources.set(name, { x: WIRE_X, y: PAD_T + i * row }));
  const levels: number[] = [];
  const gates: PlacedGate[] = [];
  const toKey = (ref: InputName | number): SourceKey => (typeof ref === 'number' ? gateKey(ref) : ref);

  topo.gates.forEach((refs, g) => {
    const level = 1 + Math.max(...refs.map((r): number => (typeof r === 'number' ? (levels[r] ?? 0) : 0)));
    levels[g] = level;
    const x = firstGateX + (level - 1) * col;
    const keys = refs.map(toKey);
    let cy = keys.reduce((s: number, k: SourceKey): number => s + point(sources, k).y, 0) / keys.length;
    // Push down until clear of gates already placed in the same column.
    const peers = gates.filter((o) => o.level === level).sort((a, b) => a.cy - b.cy);
    for (const o of peers) if (Math.abs(o.cy - cy) < GH + 28) cy = o.cy + GH + 28;
    // Upper source feeds the upper pin so wires don't cross at the gate.
    const ordered = [...keys].sort((a, b) => point(sources, a).y - point(sources, b).y);
    gates.push({ index: g, level, x, cy, inputs: ordered });
    sources.set(gateKey(g), { x: x + GW, y: cy });
  });

  const last = gates[gates.length - 1];
  if (!last) throw new Error('Topology has no gates');
  const outX = last.x + GW + outGap;
  const bottom = Math.max(PAD_T + (topo.inputs.length - 1) * row, ...gates.map((g) => g.cy + GH / 2));
  return { sources, gates, out: { x: outX, y: last.cy }, width: outX + 44, height: bottom + PAD_T };
}

export interface RenderOptions {
  readonly gates: readonly (Gate | null)[];
  readonly selected: number | null;
  /** Gate slots are clickable. */
  readonly interactive: boolean;
  /** Inputs are clickable toggles. */
  readonly probe: boolean;
  /** Live signal values; wires with a known value are coloured. */
  readonly values: SignalValues;
  /** Target output for the current inputs, shown beside Q; null to hide. */
  readonly target: Bit | null;
  /** Tighter spacing and larger text for narrow screens. */
  readonly compact: boolean;
}

function levelClass(values: SignalValues, key: SourceKey): string {
  const v = values[key];
  return v === undefined ? '' : v ? ' hi' : ' lo';
}

function wireClass(values: SignalValues, key: SourceKey): string {
  return 'wire' + levelClass(values, key);
}

export function render(topo: Topology, opts: RenderOptions): string {
  const L = layout(topo, opts.compact);
  const parts: string[] = [];
  const fanout = new Map<SourceKey, number[]>();

  // Wires: horizontal from source, vertical at a jog column, horizontal into pin.
  for (const gate of L.gates) {
    gate.inputs.forEach((key, pin) => {
      const s = point(L.sources, key);
      const py = gate.cy + (pin === 0 ? -PIN : PIN);
      const jog = gate.x - 14 - pin * 10;
      fanout.set(key, [...(fanout.get(key) ?? []), jog]);
      parts.push(`<path class="${wireClass(opts.values, key)}" d="M${s.x} ${s.y} H${jog} V${py} H${gate.x}"/>`);
    });
  }
  // Junction dots where one source branches to several pins.
  for (const [key, jogs] of fanout) {
    if (jogs.length < 2) continue;
    const far = Math.max(...jogs);
    const s = point(L.sources, key);
    for (const j of jogs) {
      if (j !== far) parts.push(`<circle class="junction ${wireClass(opts.values, key)}" cx="${j}" cy="${s.y}" r="3.5"/>`);
    }
  }
  const lastKey = gateKey(L.gates.length - 1);
  const lastSrc = point(L.sources, lastKey);
  parts.push(`<path class="${wireClass(opts.values, lastKey)}" d="M${lastSrc.x} ${lastSrc.y} H${L.out.x - 12}"/>`);

  // Inputs.
  for (const name of topo.inputs) {
    const s = point(L.sources, name);
    const v: Bit | undefined = opts.values[name];
    const cls = 'terminal' + levelClass(opts.values, name) + (opts.probe ? ' probe' : '');
    const label = v === undefined ? name : `${name}=${v}`;
    const attrs = opts.probe ? ` data-input="${name}" role="button" tabindex="0" aria-label="Toggle input ${name}"` : '';
    parts.push(
      `<g class="${cls}"${attrs}>` +
        // Invisible, finger-sized hit area around the input toggle.
        (opts.probe ? `<rect x="0" y="${s.y - 22}" width="${WIRE_X + 6}" height="44" style="fill:transparent;stroke:none"/>` : '') +
        `<rect x="4" y="${s.y - 13}" width="${WIRE_X - 8}" height="26" rx="6"/>` +
        `<text x="${(WIRE_X - 4) / 2 + 2}" y="${s.y + 5}" text-anchor="middle">${label}</text></g>`
    );
  }

  // Gates.
  for (const gate of L.gates) {
    const type: Gate | null = opts.gates[gate.index] ?? null;
    const selected = opts.selected === gate.index;
    const cls = 'slot' + (type ? ' filled' : ' empty') + (selected ? ' selected' : '');
    const attrs = opts.interactive
      ? ` data-slot="${gate.index}" role="button" tabindex="0" aria-label="Gate ${gate.index + 1}: ${type ?? 'empty'}"`
      : '';
    let inner = `<rect class="slot-hit" x="-6" y="-6" width="${GW + 12}" height="${GH + 12}" rx="10"/>`;
    if (type) {
      inner += gateSymbol(type, true);
    } else {
      inner += `<rect class="slot-empty" x="2" y="2" width="${GW - 4}" height="${GH - 4}" rx="8"/>`;
      inner += `<path class="gate-line" d="M0 ${24 - PIN} H2 M0 ${24 + PIN} H2 M${GW - 2} 24 H${GW}"/>`;
      inner += `<text class="slot-q" x="${GW / 2}" y="30" text-anchor="middle">?</text>`;
    }
    inner += `<text class="slot-num" x="${GW / 2}" y="${GH + 16}" text-anchor="middle">${gate.index + 1}</text>`;
    parts.push(`<g class="${cls}" transform="translate(${gate.x} ${gate.cy - GH / 2})"${attrs}>${inner}</g>`);
  }

  // Output terminal.
  const outV: Bit | undefined = opts.values[lastKey];
  const outCls = 'terminal output' + levelClass(opts.values, lastKey);
  parts.push(
    `<g class="${outCls}"><rect x="${L.out.x - 12}" y="${L.out.y - 13}" width="48" height="26" rx="13"/>` +
      `<text x="${L.out.x + 12}" y="${L.out.y + 5}" text-anchor="middle">${outV === undefined ? 'Q' : 'Q=' + outV}</text></g>`
  );
  if (opts.target !== null) {
    const verdict = outV === undefined ? '' : outV === opts.target ? ' match' : ' mismatch';
    parts.push(
      `<text class="target-note${verdict}" x="${L.out.x + 12}" y="${L.out.y + 30}" text-anchor="middle">want ${opts.target}</text>`
    );
  }

  const svgClass = 'circuit-svg' + (opts.compact ? ' compact' : '');
  return `<svg class="${svgClass}" viewBox="0 0 ${L.width} ${L.height + 14}" role="img" aria-label="Circuit schematic">${parts.join('')}</svg>`;
}
