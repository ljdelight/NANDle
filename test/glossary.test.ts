import { describe, expect, it } from 'vitest';
import { GLOSSARY, TERM_ORDER, isTermId, termHtml } from '../src/glossary';
import type { TermId } from '../src/glossary';

const ids = Object.keys(GLOSSARY) as TermId[];

describe('GLOSSARY', () => {
  it('defines every term', () => {
    for (const id of ids) {
      expect(GLOSSARY[id].name.length).toBeGreaterThan(0);
      expect(GLOSSARY[id].definition.length).toBeGreaterThan(20);
    }
  });

  it('lists every term exactly once in the full glossary', () => {
    expect([...TERM_ORDER].sort()).toEqual([...ids].sort());
  });
});

describe('termHtml', () => {
  it('links a term with its name by default', () => {
    expect(termHtml('k-map')).toBe(
      '<button type="button" class="gloss" data-term="k-map" aria-haspopup="dialog">K-map</button>'
    );
  });

  it('accepts custom link text', () => {
    expect(termHtml('equivalent', '2 answers work')).toContain('>2 answers work</button>');
  });
});

describe('isTermId', () => {
  it('accepts known ids only', () => {
    expect(isTermId('sop')).toBe(true);
    expect(isTermId('nope')).toBe(false);
    expect(isTermId(undefined)).toBe(false);
  });
});
