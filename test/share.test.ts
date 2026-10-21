import { describe, expect, it } from 'vitest';
import { shareText } from '../src/share';
import type { ShareInput } from '../src/share';

const base: ShareInput = {
  title: 'Nandle #293 (Easy)',
  runs: [
    { score: ['present', 'absent'], matched: 5 },
    { score: ['correct', 'correct'], matched: 8 },
  ],
  won: true,
  maxRuns: 6,
  rows: 8,
  highContrast: false,
};

describe('shareText', () => {
  it('uses green and yellow squares by default', () => {
    expect(shareText(base)).toBe('Nandle #293 (Easy) 2/6\n🟨⬛ 5/8\n🟩🟩 8/8');
  });

  it('uses orange and blue squares in high-contrast mode', () => {
    expect(shareText({ ...base, highContrast: true })).toBe('Nandle #293 (Easy) 2/6\n🟦⬛ 5/8\n🟧🟧 8/8');
  });

  it('scores a loss as X', () => {
    expect(shareText({ ...base, won: false }).split('\n')[0]).toBe('Nandle #293 (Easy) X/6');
  });
});
