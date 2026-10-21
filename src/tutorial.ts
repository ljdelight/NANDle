// Guided first game: the step script and how player actions move through it.
// Pure logic; main.ts renders the coach card and feeds events in.
import type { Bit, Gate, InputName } from './logic';

export type StepId = 'welcome' | 'toggle' | 'table' | 'place' | 'run' | 'feedback' | 'retry' | 'done';

export type TutorialEvent =
  | { readonly kind: 'next' }
  | { readonly kind: 'toggle'; readonly input: InputName; readonly value: Bit }
  | { readonly kind: 'place'; readonly gate: Gate }
  | { readonly kind: 'run'; readonly won: boolean };

/** What the latest run looked like, for the feedback step's wording. */
export interface RunContext {
  readonly gate: Gate | null;
  readonly matched: number;
  readonly rows: number;
}

export interface Step {
  readonly id: StepId;
  readonly title: string;
  /** HTML; built from fixed text plus gate names and counts only. */
  readonly body: string;
  /** CSS selector of the element to spotlight, or null. */
  readonly target: string | null;
  /** Whether the step waits for a Next tap (otherwise it waits for an action). */
  readonly next: boolean;
}

export const STEP_ORDER: readonly StepId[] = ['welcome', 'toggle', 'table', 'place', 'run', 'feedback', 'retry', 'done'];

export function step(id: StepId, run: RunContext): Step {
  switch (id) {
    case 'welcome':
      return {
        id,
        title: 'Welcome to Nandle',
        body:
          'This is a tiny <b>circuit</b>. Every wire carries a signal that is either <b>1</b> (on) or <b>0</b> (off). ' +
          'Inputs <b>A</b> and <b>B</b> flow into a <b>gate</b>, which decides the output <b>Q</b>.',
        target: '#circuit',
        next: true,
      };
    case 'toggle':
      return {
        id,
        title: 'Flip a switch',
        body: 'Tap <b>A</b> to turn it on. Lit wires carry a 1.',
        target: '[data-input="A"]',
        next: false,
      };
    case 'table':
      return {
        id,
        title: 'The truth table',
        body:
          'Each column is one combination of A and B. The <b>Q</b> row is what the hidden circuit outputs for it. ' +
          'Your goal: make your circuit match every column. The outlined column is the inputs you just set.',
        target: '#truth-table',
        next: true,
      };
    case 'place':
      return {
        id,
        title: 'Pick a gate',
        body:
          'The slot is empty. Try <b>OR</b>: it outputs 1 when <i>either</i> input is 1. ' +
          '(Tap the <b>ⓘ</b> on any gate to see what it does.)',
        target: '#palette',
        next: false,
      };
    case 'run':
      return {
        id,
        title: 'Test it',
        body: 'Press <b>Run circuit</b> to check your gate against every column of the truth table.',
        target: '#btn-run',
        next: false,
      };
    case 'feedback': {
      const gate = run.gate ?? 'Your gate';
      return {
        id,
        title: 'Reading the results',
        body:
          `${gate} matched <b>${run.matched} of ${run.rows}</b> columns. The dashed cells are where it was wrong. ` +
          `Its tile under Attempts is plain gray, meaning ${gate} isn't in the hidden circuit. A ✓ tile would mean the right gate. ` +
          'Tip: tap any dashed cell to trace how your circuit got that column.',
        target: '#truth-table',
        next: true,
      };
    }
    case 'retry':
      return {
        id,
        title: 'Try again',
        body:
          'Look at the Q row: it is 1 only when A <i>and</i> B are both 1. That is exactly what <b>AND</b> does. ' +
          'Pick it and press Run.',
        target: '#palette',
        next: false,
      };
    case 'done':
      return {
        id,
        title: 'Solved! 🎉',
        body:
          "That's the whole game. Daily puzzles have more gates and inputs, and you get 6 runs. " +
          'Tap the inputs any time to test ideas. When you are stuck, the K-map helper under the truth table ' +
          'shows the pattern in the Q row.',
        target: null,
        next: false,
      };
  }
}

/** The step after `current` given a player action, or `current` if nothing changes. */
export function advance(current: StepId, event: TutorialEvent): StepId {
  // A run can happen at any point (e.g. the Enter key); its result always wins.
  if (event.kind === 'run') {
    if (event.won) return 'done';
    return current === 'retry' ? 'retry' : 'feedback';
  }
  switch (current) {
    case 'welcome':
      return event.kind === 'next' ? 'toggle' : current;
    case 'toggle':
      return event.kind === 'toggle' && event.input === 'A' && event.value === 1 ? 'table' : current;
    case 'table':
      return event.kind === 'next' ? 'place' : current;
    case 'place':
      return event.kind === 'place' ? 'run' : current;
    case 'feedback':
      return event.kind === 'next' ? 'retry' : current;
    case 'run':
    case 'retry':
    case 'done':
      return current;
  }
}
