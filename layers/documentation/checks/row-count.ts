import type { CheckResult, Criterion } from '../../../src/types.js';
import { parseTable } from './contains-table.js';

export function rowCountGte(markdown: string, criterion: Criterion): CheckResult {
  const table = parseTable(markdown);

  if (table === null) {
    return {
      criterion: criterion.check,
      pass: false,
      message: 'No table found in content.',
    };
  }

  const count = table.rows.length;
  const min = criterion.min ?? 0;

  if (count >= min) {
    return {
      criterion: criterion.check,
      pass: true,
      message: `Table has ${count} row(s), meets minimum of ${min}.`,
    };
  }

  return {
    criterion: criterion.check,
    pass: false,
    message: `Table has ${count} row(s), below minimum of ${min}.`,
  };
}

export function rowCountLte(markdown: string, criterion: Criterion): CheckResult {
  const table = parseTable(markdown);

  if (table === null) {
    return {
      criterion: criterion.check,
      pass: false,
      message: 'No table found in content.',
    };
  }

  const count = table.rows.length;
  const max = criterion.max ?? Infinity;

  if (count <= max) {
    return {
      criterion: criterion.check,
      pass: true,
      message: `Table has ${count} row(s), within maximum of ${max}.`,
    };
  }

  return {
    criterion: criterion.check,
    pass: false,
    message: `Table has ${count} row(s), exceeds maximum of ${max}.`,
  };
}
