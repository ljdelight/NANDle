// Karnaugh-map rendering: an SVG grid with group outlines, plus the matching
// colored expression as HTML.
import * as K from './kmap';
import type { Form, Implicant, KMapLayout } from './kmap';
import type { Bit, InputName } from './logic';

const S = 46; // cell size
const X0 = 64; // grid left
const Y0 = 50; // grid top
export const GROUP_COLORS = 6;

export interface KMapViewOptions {
  readonly inputs: readonly InputName[];
  readonly table: readonly Bit[];
  /** Groups to outline; empty for none. */
  readonly groups: readonly Implicant[];
  /** Latest run's outputs, used to flag wrong cells; null to hide. */
  readonly guess: readonly Bit[] | null;
}

const codeLabel = (code: number, bits: number): string => code.toString(2).padStart(bits, '0');

/** Splits sorted grid positions into contiguous runs (a wrap-around group yields two). */
function runs(positions: readonly number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const p of positions) {
    const last = out[out.length - 1];
    if (last && p === last[1] + 1) last[1] = p;
    else out.push([p, p]);
  }
  return out;
}

function groupRects(layout: KMapLayout, group: Implicant, index: number): string {
  const rows: number[] = [];
  const cols: number[] = [];
  layout.rowCodes.forEach((_, r) => {
    if (layout.colCodes.some((__, c) => K.covers(group, K.cellMinterm(layout, r, c)))) rows.push(r);
  });
  layout.colCodes.forEach((_, c) => {
    if (layout.rowCodes.some((__, r) => K.covers(group, K.cellMinterm(layout, r, c)))) cols.push(c);
  });
  const inset = 4 + (index % 4) * 3;
  const cls = `kgroup g${index % GROUP_COLORS}`;
  const attrs = ` data-group="${index}"`;
  const rects: string[] = [];
  for (const [r0, r1] of runs(rows)) {
    for (const [c0, c1] of runs(cols)) {
      const x = X0 + c0 * S + inset;
      const y = Y0 + r0 * S + inset;
      const w = (c1 - c0 + 1) * S - 2 * inset;
      const h = (r1 - r0 + 1) * S - 2 * inset;
      rects.push(`<rect class="${cls}"${attrs} x="${x}" y="${y}" width="${w}" height="${h}" rx="12"/>`);
    }
  }
  return rects.join('');
}

export function renderKMap(opts: KMapViewOptions): string {
  const layout = K.kmapLayout(opts.inputs);
  const rowsN = layout.rowCodes.length;
  const colsN = layout.colCodes.length;
  const parts: string[] = [];

  // Axis labels: row variables down the side, column variables across the top.
  parts.push(`<path class="kdiag" d="M${X0 - 42} ${Y0 - 42} L${X0} ${Y0}"/>`);
  parts.push(`<text class="kaxis" x="${X0 - 16}" y="${Y0 - 2}" text-anchor="end">${layout.rowVars.join('')}</text>`);
  parts.push(`<text class="kaxis" x="${X0 - 14}" y="${Y0 - 32}">${layout.colVars.join('')}</text>`);
  layout.colCodes.forEach((code, c) => {
    parts.push(
      `<text class="khead" x="${X0 + c * S + S / 2}" y="${Y0 - 10}" text-anchor="middle">${codeLabel(code, layout.colVars.length)}</text>`
    );
  });
  layout.rowCodes.forEach((code, r) => {
    parts.push(
      `<text class="khead" x="${X0 - 10}" y="${Y0 + r * S + S / 2 + 5}" text-anchor="end">${codeLabel(code, layout.rowVars.length)}</text>`
    );
  });

  // Cells.
  for (let r = 0; r < rowsN; r++) {
    for (let c = 0; c < colsN; c++) {
      const m = K.cellMinterm(layout, r, c);
      const v = opts.table[m] ?? 0;
      const wrong = opts.guess !== null && opts.guess[m] !== v;
      const x = X0 + c * S;
      const y = Y0 + r * S;
      parts.push(`<rect class="kcell v${v}${wrong ? ' wrong' : ''}" x="${x}" y="${y}" width="${S}" height="${S}"/>`);
      parts.push(`<text class="kval v${v}" x="${x + S / 2}" y="${y + S / 2 + 6}" text-anchor="middle">${v}</text>`);
      parts.push(`<text class="kidx" x="${x + 4}" y="${y + S - 4}">${m}</text>`);
      if (wrong) parts.push(`<circle class="kwrong" cx="${x + S - 8}" cy="${y + 8}" r="4"/>`);
    }
  }

  opts.groups.forEach((g, i) => parts.push(groupRects(layout, g, i)));

  const width = X0 + colsN * S + 12;
  const height = Y0 + rowsN * S + 8;
  return `<svg class="kmap-svg" viewBox="0 0 ${width} ${height}" style="max-width:${width * 1.25}px" role="img" aria-label="Karnaugh map of the target output">${parts.join('')}</svg>`;
}

function literalHtml(l: K.Literal): string {
  return l.negated ? `<span class="neg">${l.name}</span>` : l.name;
}

/**
 * Expression with each term colored and underlined like its group outline.
 * Terms are focusable and carry data-group so hovering can spotlight a group.
 */
export function expressionHtml(groups: readonly Implicant[], inputs: readonly InputName[], form: Form): string {
  const term = (i: number, body: string): string =>
    `<span class="term g${i % GROUP_COLORS}" data-group="${i}" tabindex="0" title="Highlight this group">${body}</span>`;
  if (form === 'sop') {
    if (groups.length === 0) return '0';
    return groups
      .map((g, i) => {
        const lits = K.literals(g, inputs, form);
        return term(i, lits.length ? lits.map(literalHtml).join('') : '1');
      })
      .join(' + ');
  }
  if (groups.length === 0) return '1';
  return groups
    .map((g, i) => {
      const lits = K.literals(g, inputs, form);
      if (lits.length === 0) return term(i, '0');
      const body = lits.map(literalHtml).join(' + ');
      return term(i, lits.length > 1 || groups.length > 1 ? `(${body})` : body);
    })
    .join('');
}
