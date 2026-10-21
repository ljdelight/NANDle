// Copying the spoiler-free result text to the clipboard.
import { shareText as formatShare } from '../share';
import { toast } from './dom';
import { settings } from './prefs';
import { MAX_RUNS, isDaily, state } from './state';

function shareText(): string {
  const p = state.puzzle;
  return formatShare({
    title: isDaily(p) ? `Nandle #${p.number} (${p.difficulty})` : `Nandle practice (${p.difficulty})`,
    runs: state.guesses,
    won: state.status === 'won',
    maxRuns: MAX_RUNS,
    rows: p.table.length,
    highContrast: settings.highContrast,
  });
}

export function share(): void {
  const text = shareText();
  const done = (): void => toast('Copied results to clipboard');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}

function fallbackCopy(text: string, done: () => void): void {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    done();
  } catch {
    toast('Could not copy');
  }
  ta.remove();
}
