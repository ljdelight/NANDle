// The game in progress: its state, how puzzles are loaded, and daily saves.
import * as L from '../logic';
import type { Bit, DailyPuzzle, Difficulty, Gate, Puzzle, Score, Topology } from '../logic';
import type { StepId } from '../tutorial';
import { KEYS, isRecord, store } from './storage';

export const MAX_RUNS = 6;

/** Modes reachable from the header; the tutorial is entered separately. */
export type PlayMode = 'daily' | 'practice';
export type Mode = PlayMode | 'tutorial';
export type Status = 'playing' | 'won' | 'lost';

export interface Guess {
  readonly gates: readonly Gate[];
  readonly score: readonly Score[];
  readonly table: readonly Bit[];
  readonly matched: number;
}

export interface GameState {
  mode: Mode;
  puzzle: Puzzle | DailyPuzzle;
  topo: Topology;
  guesses: Guess[];
  current: (Gate | null)[];
  selected: number;
  status: Status;
  /** Current input values, one per topology input, for probing the circuit. */
  probe: Bit[];
  /** Current tutorial step; null outside the tutorial. */
  coach: StepId | null;
  /** Index of the past run being traced in the circuit view; null when editing. */
  trace: number | null;
}

interface SavedDaily {
  topoId: string;
  guesses: Gate[][];
  status: Status;
}

function isStatus(v: unknown): v is Status {
  return v === 'playing' || v === 'won' || v === 'lost';
}

function isSavedDaily(v: unknown): v is SavedDaily {
  return (
    isRecord(v) &&
    typeof v.topoId === 'string' &&
    isStatus(v.status) &&
    Array.isArray(v.guesses) &&
    v.guesses.every((g: unknown) => Array.isArray(g) && g.every(L.isGate))
  );
}

export function isDaily(p: Puzzle | DailyPuzzle): p is DailyPuzzle {
  return 'number' in p;
}

/** The current game; other modules read it live and mutate its fields. */
export let state: GameState;
export let practiceDifficulty: Difficulty = 'Medium';

export function setPracticeDifficulty(d: Difficulty): void {
  practiceDifficulty = d;
}

function startGame(mode: Mode, puzzle: Puzzle | DailyPuzzle): void {
  const topo = L.TOPOLOGIES[puzzle.topoId];
  state = {
    mode,
    puzzle,
    topo,
    guesses: [],
    current: topo.gates.map((): Gate | null => null),
    selected: 0,
    status: 'playing',
    probe: topo.inputs.map((): Bit => 0),
    coach: null,
    trace: null,
  };
}

export function makeGuess(gates: readonly Gate[]): Guess {
  const table = L.truthTable(state.topo, gates);
  return {
    gates,
    score: L.scoreGuess(state.puzzle.solution, gates),
    table,
    matched: L.matchingRows(state.puzzle.table, table),
  };
}

export function loadDaily(): void {
  const puzzle = L.dailyPuzzle(new Date());
  startGame('daily', puzzle);
  const saved = store.get<SavedDaily | null>(KEYS.daily(puzzle.dateKey), null, isSavedDaily);
  const fits = (gates: readonly Gate[]): boolean =>
    gates.length === puzzle.solution.length && gates.every((g) => puzzle.gates.includes(g));
  if (saved && saved.topoId === puzzle.topoId && saved.guesses.every(fits)) {
    state.guesses = saved.guesses.map(makeGuess);
    state.status = saved.status;
    if (state.status !== 'playing') finishBoard();
  }
}

export function loadTutorial(): void {
  startGame('tutorial', L.tutorialPuzzle());
  state.coach = 'welcome';
}

export function loadPractice(): void {
  const seed = Math.floor(Math.random() * 1e9);
  startGame('practice', L.practicePuzzle(practiceDifficulty, seed));
}

export function saveDaily(): void {
  if (!isDaily(state.puzzle)) return;
  const saved: SavedDaily = {
    topoId: state.puzzle.topoId,
    guesses: state.guesses.map((g) => [...g.gates]),
    status: state.status,
  };
  store.set(KEYS.daily(state.puzzle.dateKey), saved);
}

/** After a game ends, show the winning circuit or, on a loss, the hidden one. */
export function finishBoard(): void {
  const last = state.guesses[state.guesses.length - 1];
  state.current = state.status === 'won' && last ? [...last.gates] : [...state.puzzle.solution];
}

export const filledGates = (current: readonly (Gate | null)[]): Gate[] | null =>
  current.every((g): g is Gate => g !== null) ? [...current] : null;

export const isPlaying = (): boolean => state.status === 'playing';

/** The gates on show: a traced past run, or the circuit being built. */
export function shownGates(): readonly (Gate | null)[] {
  const traced = state.trace === null ? undefined : state.guesses[state.trace];
  return traced ? traced.gates : state.current;
}
