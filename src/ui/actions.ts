// What the player can do: build and run circuits, probe and trace, switch modes.
import * as L from '../logic';
import type { Gate } from '../logic';
import { coachEvent, resetCoachScroll } from './coach';
import { $, shake, toast } from './dom';
import { refreshPlay, render, renderCircuit, renderTable } from './render';
import {
  MAX_RUNS,
  filledGates,
  finishBoard,
  loadDaily,
  loadPractice,
  loadTutorial,
  makeGuess,
  saveDaily,
  setPracticeDifficulty,
  state,
} from './state';
import type { PlayMode } from './state';
import { openStats, recordStats } from './stats';
import { KEYS, store } from './storage';

/** Stops tracing; returns whether a trace was showing. */
export function leaveTrace(): boolean {
  if (state.trace === null) return false;
  state.trace = null;
  renderTable();
  return true;
}

export function selectSlot(i: number): void {
  if (state.status !== 'playing') return;
  leaveTrace();
  const count = state.current.length;
  state.selected = ((i % count) + count) % count;
  renderCircuit();
}

export function placeGate(type: Gate): void {
  if (state.status !== 'playing' || !state.puzzle.gates.includes(type)) return;
  leaveTrace();
  state.current[state.selected] = type;
  // Advance to the next empty slot, or stay put if the circuit is full.
  const count = state.current.length;
  for (let step = 1; step <= count; step++) {
    const idx = (state.selected + step) % count;
    if (!state.current[idx]) {
      state.selected = idx;
      break;
    }
  }
  refreshPlay();
  coachEvent({ kind: 'place', gate: type });
}

export function clearSlot(): void {
  if (state.status !== 'playing') return;
  leaveTrace();
  if (state.current[state.selected]) state.current[state.selected] = null;
  else selectSlot(state.selected - 1);
  refreshPlay();
}

export function clearAll(): void {
  if (state.status !== 'playing') return;
  leaveTrace();
  state.current = state.current.map((): Gate | null => null);
  state.selected = 0;
  render();
}

export function run(): void {
  if (state.status !== 'playing') return;
  leaveTrace();
  const gates = filledGates(state.current);
  if (!gates) {
    toast('Fill every gate slot first');
    shake();
    return;
  }
  const key = gates.join(',');
  if (state.guesses.some((g) => g.gates.join(',') === key)) {
    toast('You already ran that circuit');
    shake();
    return;
  }
  const guess = makeGuess(gates);
  state.guesses.push(guess);
  if (guess.matched === state.puzzle.table.length) state.status = 'won';
  else if (state.guesses.length >= MAX_RUNS) state.status = 'lost';

  if (state.status === 'playing') {
    // Keep the correct gates in place for the next attempt.
    state.current = guess.gates.map((g, i): Gate | null => (guess.score[i] === 'correct' ? g : null));
    const firstEmpty = state.current.findIndex((g) => !g);
    state.selected = firstEmpty === -1 ? 0 : firstEmpty;
  } else {
    finishBoard();
    recordStats();
  }
  saveDaily();
  render();
  coachEvent({ kind: 'run', won: state.status === 'won' });
  if (state.status !== 'playing' && state.mode === 'daily') setTimeout(openStats, 1400);
}

export function toggleInput(name: string): void {
  const i = state.topo.inputs.findIndex((n) => n === name);
  if (i === -1) return;
  const value = state.probe[i] ? 0 : 1;
  state.probe[i] = value;
  renderCircuit();
  renderTable();
  const input = state.topo.inputs[i];
  if (input) coachEvent({ kind: 'toggle', input, value });
}

/** Jumps the circuit's inputs to a truth-table column; a run's cell also traces that run. */
export function showColumn(column: number, run: number | null): void {
  state.probe = L.rowBits(column, state.topo.inputs.length);
  state.trace = run;
  renderCircuit();
  renderTable();
  // On a phone the circuit is usually scrolled away by the time you reach the table.
  const card = $('.circuit-card');
  if (card.getBoundingClientRect().top < 0) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function newPractice(): void {
  loadPractice();
  render();
}

export function switchMode(mode: PlayMode): void {
  if (mode === state.mode) return;
  // Leaving the tutorial any way counts as finishing it, so it won't reappear.
  if (state.mode === 'tutorial') store.set(KEYS.tutorialDone, true);
  if (mode === 'daily') loadDaily();
  else loadPractice();
  render();
}

export function startTutorial(): void {
  resetCoachScroll();
  loadTutorial();
  render();
  window.scrollTo({ top: 0 });
}

export function endTutorial(next: PlayMode): void {
  store.set(KEYS.tutorialDone, true);
  if (next === 'practice') setPracticeDifficulty('Beginner');
  switchMode(next);
}
