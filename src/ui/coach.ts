// The tutorial's coach card: renders the current step and feeds player actions to it.
import * as T from '../tutorial';
import type { StepId, TutorialEvent } from '../tutorial';
import { $ } from './dom';
import { state } from './state';
import { KEYS, store } from './storage';

let scrolledToStep: StepId | null = null;

/** Lets the next rendered step scroll its target into view again. */
export function resetCoachScroll(): void {
  scrolledToStep = null;
}

export function coachEvent(event: TutorialEvent): void {
  if (!state.coach) return;
  const next = T.advance(state.coach, event);
  if (next === state.coach) return;
  state.coach = next;
  if (next === 'done') store.set(KEYS.tutorialDone, true);
  renderCoach();
}

function runContext(): T.RunContext {
  const last = state.guesses[state.guesses.length - 1];
  return { gate: last?.gates[0] ?? null, matched: last?.matched ?? 0, rows: state.puzzle.table.length };
}

export function renderCoach(): void {
  const el = $('#coach');
  document.body.classList.toggle('coaching', state.coach !== null);
  if (!state.coach) {
    el.hidden = true;
    spotlightCoachTarget();
    return;
  }
  const step = T.step(state.coach, runContext());
  const index = T.STEP_ORDER.indexOf(step.id) + 1;
  const actions =
    step.id === 'done'
      ? '<button class="btn primary" data-coach="daily">Play today\'s puzzle</button>' +
        '<button class="btn ghost" data-coach="practice">Practice: Beginner</button>'
      : step.next
        ? '<button class="btn primary" data-coach="next">Next</button>'
        : '';
  el.hidden = false;
  el.innerHTML =
    `<div class="coach-head"><span class="coach-step">Step ${index} of ${T.STEP_ORDER.length}</span>` +
    (step.id === 'done' ? '' : '<button class="coach-skip" data-coach="skip">Skip tutorial</button>') +
    `</div><h2>${step.title}</h2><p>${step.body}</p>` +
    (actions ? `<div class="coach-actions">${actions}</div>` : '');
  spotlightCoachTarget();
  if (scrolledToStep !== step.id) {
    scrolledToStep = step.id;
    const target = step.target ? document.querySelector(step.target) : null;
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/** Re-applied after every circuit render, since the SVG is rebuilt. */
export function spotlightCoachTarget(): void {
  document.querySelectorAll('.coach-target').forEach((el) => el.classList.remove('coach-target'));
  const selector = state.coach ? T.step(state.coach, runContext()).target : null;
  if (selector) document.querySelector(selector)?.classList.add('coach-target');
}
