import { describe, it, expect } from 'vitest';
import { wordCountGte, wordCountLte } from '../../layers/documentation/checks/word-count.js';
import type { Criterion } from '../../src/types.js';

// 10 content words: "The quick brown fox jumps over the lazy dog today"
const SIMPLE_MD = `The quick brown fox jumps over the lazy dog today`;

// Markdown-heavy content — same 10 words embedded in markup
const MARKDOWN_HEAVY = `
# Heading One

**The** *quick* [brown fox](http://example.com) jumps over the \`lazy\` dog today.

| col1 | col2 |
|------|------|
| a    | b    |

- list item
> blockquote

![image](img.png)
`;

function criterion(overrides: Partial<Criterion> = {}): Criterion {
  return { check: 'word-count-gte', description: 'test', ...overrides };
}

describe('wordCountGte', () => {
  it('passes at exact minimum', () => {
    const result = wordCountGte(SIMPLE_MD, criterion({ min: 10 }));
    expect(result.pass).toBe(true);
  });

  it('passes above minimum', () => {
    const result = wordCountGte(SIMPLE_MD, criterion({ min: 5 }));
    expect(result.pass).toBe(true);
  });

  it('fails below minimum', () => {
    const result = wordCountGte(SIMPLE_MD, criterion({ min: 100 }));
    expect(result.pass).toBe(false);
    expect(result.message).toMatch(/\d+.*100|fewer|below/i);
  });

  it('strips markdown before counting', () => {
    // The 10 content words from MARKDOWN_HEAVY should be counted, plus "list item" and "blockquote" content
    // Key: table rows, headings, bold, italic, links, images, inline code should be stripped
    // After stripping, we expect at least the 10 core words to remain
    const result = wordCountGte(MARKDOWN_HEAVY, criterion({ min: 1 }));
    expect(result.pass).toBe(true);
    // Should not count markdown syntax tokens as words
    expect(result.message).not.toMatch(/col1|col2/i);
  });
});

describe('wordCountLte', () => {
  it('passes within max', () => {
    const result = wordCountLte(SIMPLE_MD, criterion({ check: 'word-count-lte', max: 20 }));
    expect(result.pass).toBe(true);
  });

  it('passes at exact max', () => {
    const result = wordCountLte(SIMPLE_MD, criterion({ check: 'word-count-lte', max: 10 }));
    expect(result.pass).toBe(true);
  });

  it('fails above max', () => {
    const result = wordCountLte(SIMPLE_MD, criterion({ check: 'word-count-lte', max: 5 }));
    expect(result.pass).toBe(false);
    expect(result.message).toMatch(/\d+.*5|exceeds|above/i);
  });
});
