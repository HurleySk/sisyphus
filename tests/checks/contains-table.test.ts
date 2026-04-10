import { describe, it, expect } from 'vitest';
import { parseTable, containsTable } from '../../layers/documentation/checks/contains-table.js';
import type { Criterion } from '../../src/types.js';

const TABLE_MD = `
| Name | Value | Status |
|------|-------|--------|
| foo  | 42    | active |
| bar  | 99    | inactive |
`;

const NO_TABLE_MD = `
# Just a heading

Some plain text with no table at all.
`;

function criterion(overrides: Partial<Criterion> = {}): Criterion {
  return { check: 'contains-table', description: 'test', ...overrides };
}

describe('parseTable', () => {
  it('returns columns and rows for a valid table', () => {
    const result = parseTable(TABLE_MD);
    expect(result).not.toBeNull();
    expect(result!.columns).toEqual(['Name', 'Value', 'Status']);
    expect(result!.rows).toHaveLength(2);
    expect(result!.rows[0]).toEqual(['foo', '42', 'active']);
    expect(result!.rows[1]).toEqual(['bar', '99', 'inactive']);
  });

  it('returns null when no table present', () => {
    expect(parseTable(NO_TABLE_MD)).toBeNull();
  });
});

describe('containsTable', () => {
  it('passes when table is present and no columns required', () => {
    const result = containsTable(TABLE_MD, criterion());
    expect(result.pass).toBe(true);
    expect(result.criterion).toBe('contains-table');
  });

  it('passes when required columns are present', () => {
    const result = containsTable(TABLE_MD, criterion({ columns: ['Name', 'Value'] }));
    expect(result.pass).toBe(true);
  });

  it('matches columns case-insensitively', () => {
    const result = containsTable(TABLE_MD, criterion({ columns: ['name', 'STATUS'] }));
    expect(result.pass).toBe(true);
  });

  it('fails when no table is present', () => {
    const result = containsTable(NO_TABLE_MD, criterion());
    expect(result.pass).toBe(false);
    expect(result.message).toMatch(/no table/i);
  });

  it('fails when a required column is missing', () => {
    const result = containsTable(TABLE_MD, criterion({ columns: ['Name', 'Missing'] }));
    expect(result.pass).toBe(false);
    expect(result.message).toMatch(/missing/i);
  });

  it('ignores tables inside code blocks', () => {
    const md = '# Example\n\nSome text.\n\n```\n| Fake | Table |\n|------|-------|\n| a    | b     |\n```\n';
    const result = containsTable(md, criterion());
    expect(result.pass).toBe(false);
  });

  it('handles escaped pipes in cells', () => {
    const md = '| Name | Value |\n|------|-------|\n| a \\| b | c |\n';
    const result = containsTable(md, criterion({ columns: ['Name', 'Value'] }));
    expect(result.pass).toBe(true);
  });
});
