// Spoiler-free result text for sharing, Wordle style.
import type { Score } from './logic';

export interface ShareInput {
  /** e.g. "Nandle #293 (Easy)" or "Nandle practice (Hard)" */
  readonly title: string;
  readonly runs: readonly { readonly score: readonly Score[]; readonly matched: number }[];
  readonly won: boolean;
  readonly maxRuns: number;
  /** Truth-table rows per run, for the "5/8" column. */
  readonly rows: number;
  /** Orange/blue squares instead of green/yellow. */
  readonly highContrast: boolean;
}

const EMOJI: Readonly<Record<'standard' | 'high', Readonly<Record<Score, string>>>> = {
  standard: { correct: '🟩', present: '🟨', absent: '⬛' },
  high: { correct: '🟧', present: '🟦', absent: '⬛' },
};

export function shareText(input: ShareInput): string {
  const emoji = EMOJI[input.highContrast ? 'high' : 'standard'];
  const score = input.won ? String(input.runs.length) : 'X';
  const lines = input.runs.map((r) => r.score.map((s) => emoji[s]).join('') + ` ${r.matched}/${input.rows}`);
  return `${input.title} ${score}/${input.maxRuns}\n${lines.join('\n')}`;
}
