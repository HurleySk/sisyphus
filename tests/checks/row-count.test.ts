import { describe, it, expect } from 'vitest';
import { rowCountGte, rowCountLte } from '../../layers/documentation/checks/row-count.js';
import type { Criterion } from '../../src/types.js';

// 3 data rows
const TABLE_3_ROWS = `
| A | B |
|---|---|
| 1 | 2 |
| 3 | 4 |
| 5 | 6 |
`;

const NO_TABLE = `No table here.`;

function criterion(overrides: Partial<Criterion> = {}): Criterion {
  return { check: 'row-count-gte', description: 'test', ...overrides };
}

describe('rowCountGte', () => {
  it('passes at exact minimum', () => {
    const result = rowCountGte(TABLE_3_ROWS, criterion({ min: 3 }));
    expect(result.pass).toBe(true);
  });

  it('passes above minimum', () => {
    const result = rowCountGte(TABLE_3_ROWS, criterion({ min: 2 }));
    expect(result.pass).toBe(true);
  });

  it('fails below minimum', () => {
    const result = rowCountGte(TABLE_3_ROWS, criterion({ min: 4 }));
    expect(result.pass).toBe(false);
    expect(result.message).toMatch(/3.*4|fewer|below|minimum/i);
  });

  it('fails when no table found', () => {
    const result = rowCountGte(NO_TABLE, criterion({ min: 1 }));
    expect(result.pass).toBe(false);
    expect(result.message).toMatch(/no table/i);
  });
});

describe('rowCountLte', () => {
  it('passes within max', () => {
    const result = rowCountLte(TABLE_3_ROWS, criterion({ check: 'row-count-lte', max: 5 }));
    expect(result.pass).toBe(true);
  });

  it('passes at exact max', () => {
    const result = rowCountLte(TABLE_3_ROWS, criterion({ check: 'row-count-lte', max: 3 }));
    expect(result.pass).toBe(true);
  });

  it('fails above max', () => {
    const result = rowCountLte(TABLE_3_ROWS, criterion({ check: 'row-count-lte', max: 2 }));
    expect(result.pass).toBe(false);
    expect(result.message).toMatch(/3.*2|exceeds|above|maximum/i);
  });

  it('fails when no table found', () => {
    const result = rowCountLte(NO_TABLE, criterion({ check: 'row-count-lte', max: 10 }));
    expect(result.pass).toBe(false);
    expect(result.message).toMatch(/no table/i);
  });
});
