// The K-map helper card.
import { termHtml } from '../glossary';
import * as K from '../kmap';
import { expressionHtml, renderKMap } from '../kmapView';
import { $, closestData } from './dom';
import { helper, isHelperForm, saveHelperPrefs } from './prefs';
import type { HelperForm } from './prefs';
import { state } from './state';

const HELPER_FORMS: readonly [HelperForm, string][] = [
  ['none', 'Map only'],
  ['sop', 'Group 1s'],
  ['pos', 'Group 0s'],
];

/** Notes under the map, as HTML built from fixed text and input names. */
function helperNotes(form: HelperForm): string {
  const notes: string[] = [];
  if (form === 'none') {
    notes.push(
      'Neighboring cells differ by exactly one input (edges wrap). Blocks of 1, 2, 4 or 8 matching cells simplify to a single term.'
    );
  } else if (form === 'sop') {
    notes.push(`${termHtml('sop', 'Sum of products')}: AND terms feeding an OR, which is the same as NAND gates feeding a NAND.`);
  } else {
    notes.push(`${termHtml('pos', 'Product of sums')}: OR terms feeding an AND, which is the same as NOR gates feeding a NOR.`);
  }
  const parity = K.parityHint(state.puzzle.table, state.topo.inputs);
  if (parity) {
    const gate = parity.inverted ? 'XNOR' : 'XOR';
    notes.push(
      `Checkerboard: Q is the ${parity.inverted ? 'inverted ' : ''}${termHtml('parity', 'parity')} of ${parity.vars.join(', ')}. ` +
        `No groups merge, so think ${gate}-style gates.`
    );
  }
  notes.push("Your circuit's shape is fixed, so use the map as a clue rather than a wiring diagram.");
  return notes.join(' ');
}

export function renderHelper(): void {
  // Keep the first game uncluttered.
  $('#kmap-card').hidden = state.mode === 'tutorial';
  const btn = $('#btn-kmap');
  btn.textContent = helper.open ? 'Hide' : 'Show';
  btn.setAttribute('aria-expanded', String(helper.open));
  $('#kmap-body').hidden = !helper.open;
  if (!helper.open) return;

  $('#kmap-form').innerHTML = HELPER_FORMS.map(
    ([form, label]) => `<button role="radio" aria-checked="${form === helper.form}" data-form="${form}">${label}</button>`
  ).join('');
  const markBox = $<HTMLInputElement>('#kmap-guess');
  const last = state.guesses[state.guesses.length - 1];
  markBox.checked = helper.markGuess;
  markBox.disabled = !last;

  const { inputs } = state.topo;
  const form = helper.form;
  const groups = form === 'none' ? [] : K.minimize(state.puzzle.table, inputs.length, form);
  $('#kmap').innerHTML = renderKMap({
    inputs,
    table: state.puzzle.table,
    groups,
    guess: helper.markGuess && last ? last.table : null,
  });
  $('#kmap-expr').innerHTML = form === 'none' ? '' : `Q = ${expressionHtml(groups, inputs, form)}`;
  $('#kmap-expr').hidden = form === 'none';
  $('#kmap-notes').innerHTML = helperNotes(form);
}

function saveAndRender(): void {
  saveHelperPrefs();
  renderHelper();
}

export function bindHelper(): void {
  $('#btn-kmap').addEventListener('click', () => {
    helper.open = !helper.open;
    saveAndRender();
  });
  $('#kmap-form').addEventListener('click', (e: MouseEvent) => {
    const form = closestData(e.target, 'form')?.dataset.form;
    if (!isHelperForm(form)) return;
    helper.form = form;
    saveAndRender();
  });
  // Spotlight a K-map group while its term is hovered, focused or tapped.
  const kmapBody = $('#kmap-body');
  const spotlight = (e: Event): void => {
    const group = closestData(e.target, 'group')?.dataset.group;
    if (group === undefined) delete kmapBody.dataset.focus;
    else kmapBody.dataset.focus = group;
  };
  const expr = $('#kmap-expr');
  expr.addEventListener('mouseover', spotlight);
  expr.addEventListener('focusin', spotlight);
  expr.addEventListener('click', spotlight);
  expr.addEventListener('mouseleave', () => delete kmapBody.dataset.focus);
  expr.addEventListener('focusout', () => delete kmapBody.dataset.focus);
  $<HTMLInputElement>('#kmap-guess').addEventListener('change', (e: Event) => {
    if (e.target instanceof HTMLInputElement) helper.markGuess = e.target.checked;
    saveAndRender();
  });
}
