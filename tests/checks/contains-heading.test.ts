import { describe, it, expect } from 'vitest';
import { containsHeading } from '../../layers/documentation/checks/contains-heading.js';
import { criterion } from '../helpers.js';

const MD = `
# Introduction

Some text here.

## Background Details

More text.

### Sub-section

Even more.
`;

describe('containsHeading', () => {
  it('finds heading by text (exact match)', () => {
    const result = containsHeading(MD, criterion({ check: 'contains-heading', heading: 'Introduction' }));
    expect(result.pass).toBe(true);
  });

  it('matches heading text case-insensitively', () => {
    const result = containsHeading(MD, criterion({ check: 'contains-heading', heading: 'introduction' }));
    expect(result.pass).toBe(true);
  });

  it('matches heading as substring', () => {
    const result = containsHeading(MD, criterion({ check: 'contains-heading', heading: 'Background' }));
    expect(result.pass).toBe(true);
  });

  it('passes when level matches', () => {
    const result = containsHeading(MD, criterion({ check: 'contains-heading', heading: 'Introduction', level: 1 }));
    expect(result.pass).toBe(true);
  });

  it('fails when heading found but at wrong level', () => {
    const result = containsHeading(MD, criterion({ check: 'contains-heading', heading: 'Introduction', level: 2 }));
    expect(result.pass).toBe(false);
    expect(result.message).toMatch(/level|wrong/i);
  });

  it('fails when heading text not found', () => {
    const result = containsHeading(MD, criterion({ check: 'contains-heading', heading: 'Nonexistent Section' }));
    expect(result.pass).toBe(false);
    expect(result.message).toMatch(/not found|missing/i);
  });

  it('handles level check for h2', () => {
    const result = containsHeading(MD, criterion({ check: 'contains-heading', heading: 'Background Details', level: 2 }));
    expect(result.pass).toBe(true);
  });

  it('ignores headings inside code blocks', () => {
    const md = 'Some text.\n\n```bash\n# this is a comment\n```\n';
    const result = containsHeading(md, criterion({ check: 'contains-heading', heading: 'this is a comment' }));
    expect(result.pass).toBe(false);
  });
});
