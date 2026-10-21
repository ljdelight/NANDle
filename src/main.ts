// Entry point: wires page events to the UI modules and starts the first game.
import './style.css';
import type { Difficulty } from './logic';
import * as L from './logic';
import {
  clearAll,
  clearSlot,
  endTutorial,
  leaveTrace,
  newPractice,
  placeGate,
  run,
  selectSlot,
  showColumn,
  startTutorial,
  switchMode,
  toggleInput,
} from './ui/actions';
import { coachEvent } from './ui/coach';
import { $, closestData, narrowScreen } from './ui/dom';
import { bindGateCard, openGateCard } from './ui/gateCard';
import { bindGlossary, renderGlossaryList } from './ui/glossary';
import { bindHelper } from './ui/helper';
import { applySettings, saveSettings, settings } from './ui/prefs';
import { render, renderCircuit, renderGateRef } from './ui/render';
import { share } from './ui/sharing';
import { loadDaily, loadTutorial, setPracticeDifficulty, state } from './ui/state';
import type { PlayMode } from './ui/state';
import { bindStats } from './ui/stats';
import { KEYS, isTrue, store } from './ui/storage';

const isMode = (v: string | undefined): v is PlayMode => v === 'daily' || v === 'practice';
const isDifficulty = (v: string | undefined): v is Difficulty =>
  v !== undefined && (L.DIFFICULTIES as readonly string[]).includes(v);

function bindCircuit(): void {
  const circuit = $('#circuit');
  circuit.addEventListener('click', (e: MouseEvent) => {
    const slot = closestData(e.target, 'slot');
    if (slot) return selectSlot(Number(slot.dataset.slot));
    const input = closestData(e.target, 'input');
    if (input?.dataset.input) toggleInput(input.dataset.input);
  });
  circuit.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    // Handled here so the page-wide "Enter = run" shortcut doesn't also fire.
    const slot = closestData(e.target, 'slot');
    const input = closestData(e.target, 'input');
    if (slot) selectSlot(Number(slot.dataset.slot));
    else if (input?.dataset.input) toggleInput(input.dataset.input);
    else return;
    e.preventDefault();
    e.stopPropagation();
  });
  $('#truth-table').addEventListener('click', (e: MouseEvent) => {
    const cell = closestData(e.target, 'col');
    if (!cell) return;
    const traced = cell.dataset.run;
    showColumn(Number(cell.dataset.col), traced === undefined ? null : Number(traced));
  });
  $('#trace-bar').addEventListener('click', (e: MouseEvent) => {
    if (closestData(e.target, 'action')?.dataset.action === 'end-trace' && leaveTrace()) renderCircuit();
  });
  $('#formula').addEventListener('click', (e: MouseEvent) => {
    const part = closestData(e.target, 'fx');
    if (part) selectSlot(Number(part.dataset.fx));
  });
  narrowScreen.addEventListener('change', renderCircuit);
}

function bindPalette(): void {
  const palette = $('#palette');
  // Long-pressing a gate opens its card instead of placing it.
  let pressTimer: ReturnType<typeof setTimeout> | undefined;
  let longPressed = false;
  palette.addEventListener('pointerdown', (e: PointerEvent) => {
    const gate = closestData(e.target, 'gate')?.dataset.gate;
    if (!L.isGate(gate)) return;
    longPressed = false;
    pressTimer = setTimeout(() => {
      longPressed = true;
      openGateCard(gate);
    }, 500);
  });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel'] as const) {
    palette.addEventListener(type, () => clearTimeout(pressTimer));
  }
  palette.addEventListener('contextmenu', (e: MouseEvent) => {
    if (closestData(e.target, 'gate')) e.preventDefault();
  });
  palette.addEventListener('click', (e: MouseEvent) => {
    const info = closestData(e.target, 'info')?.dataset.info;
    if (L.isGate(info)) return openGateCard(info);
    if (longPressed) {
      longPressed = false;
      return;
    }
    const gate = closestData(e.target, 'gate')?.dataset.gate;
    if (L.isGate(gate)) placeGate(gate);
  });
  $('#btn-run').addEventListener('click', run);
  $('#btn-clear').addEventListener('click', clearAll);
}

function bindModes(): void {
  $('#result').addEventListener('click', (e: MouseEvent) => {
    const action = closestData(e.target, 'action')?.dataset.action;
    if (action === 'share') share();
    else if (action === 'practice') switchMode('practice');
    else if (action === 'new') newPractice();
  });
  document.querySelectorAll<HTMLButtonElement>('.mode').forEach((b) => {
    b.addEventListener('click', () => {
      if (isMode(b.dataset.mode)) switchMode(b.dataset.mode);
    });
  });
  $('#difficulty').addEventListener('click', (e: MouseEvent) => {
    const difficulty = closestData(e.target, 'difficulty')?.dataset.difficulty;
    if (!isDifficulty(difficulty)) return;
    setPracticeDifficulty(difficulty);
    newPractice();
  });
  $('#btn-new').addEventListener('click', newPractice);
}

function bindDialogs(): void {
  $('#btn-help').addEventListener('click', () => $<HTMLDialogElement>('#dlg-help').showModal());
  $('#btn-tutorial').addEventListener('click', () => {
    $<HTMLDialogElement>('#dlg-help').close();
    startTutorial();
  });
  $('#coach').addEventListener('click', (e: MouseEvent) => {
    const action = closestData(e.target, 'coach')?.dataset.coach;
    if (action === 'next') coachEvent({ kind: 'next' });
    else if (action === 'skip' || action === 'daily') endTutorial('daily');
    else if (action === 'practice') endTutorial('practice');
  });
  $('#btn-settings').addEventListener('click', () => $<HTMLDialogElement>('#dlg-settings').showModal());
  $<HTMLInputElement>('#set-contrast').addEventListener('change', (e: Event) => {
    if (!(e.target instanceof HTMLInputElement)) return;
    settings.highContrast = e.target.checked;
    saveSettings();
  });
}

function bindKeyboard(): void {
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
    if (e.key === 'Escape' && leaveTrace()) {
      renderCircuit();
      return;
    }
    if (e.target instanceof Element && e.target.closest('button') && (e.key === 'Enter' || e.key === ' ')) return;
    const n = Number(e.key);
    const gate = Number.isInteger(n) && n >= 1 ? state.puzzle.gates[n - 1] : undefined;
    if (gate) placeGate(gate);
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') selectSlot(state.selected + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') selectSlot(state.selected - 1);
    else if (e.key === 'Backspace' || e.key === 'Delete') clearSlot();
    else if (e.key === 'Enter') run();
    else if (/^[a-d]$/i.test(e.key)) toggleInput(e.key.toUpperCase());
    else return;
    e.preventDefault();
  });
}

applySettings();
// First-time players start with the guided warm-up instead of a wall of rules.
if (store.get<boolean>(KEYS.tutorialDone, false, isTrue)) loadDaily();
else loadTutorial();
bindCircuit();
bindPalette();
bindModes();
bindDialogs();
bindKeyboard();
bindHelper();
bindStats();
bindGateCard(placeGate);
bindGlossary();
renderGateRef();
renderGlossaryList();
render();
