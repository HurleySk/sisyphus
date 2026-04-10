import type { CheckResult, Criterion } from '../../../src/types.js';
import { stripFencedCodeBlocks, splitTableRow } from './markdown-utils.js';

export interface ParsedTable {
  columns: string[];
  rows: string[][];
}

/**
 * Parse the first markdown table found in the text.
 * A valid table is: header row | sep row | 0+ data rows.
 * Returns null if no valid table is found.
 */
export function parseTable(markdown: string): ParsedTable | null {
  const stripped = stripFencedCodeBlocks(markdown);
  const lines = stripped.split('\n');

  for (let i = 0; i < lines.length - 1; i++) {
    const headerLine = lines[i].trim();
    const sepLine = lines[i + 1]?.trim() ?? '';

    // Header row must start and end with |
    if (!headerLine.startsWith('|') || !headerLine.endsWith('|')) continue;

    // Separator row must be only |, -, :, and spaces
    if (!sepLine.startsWith('|') || !sepLine.endsWith('|')) continue;
    if (!/^\|[\s|:\-]+\|$/.test(sepLine)) continue;

    // Parse columns from header using splitTableRow
    const columns = splitTableRow(headerLine).filter((c) => c.length > 0);

    if (columns.length === 0) continue;

    // Parse data rows
    const rows: string[][] = [];
    for (let j = i + 2; j < lines.length; j++) {
      const rowLine = lines[j].trim();
      if (!rowLine.startsWith('|') || !rowLine.endsWith('|')) break;
      const cells = splitTableRow(rowLine);
      rows.push(cells);
    }

    return { columns, rows };
  }

  return null;
}

export function containsTable(markdown: string, criterion: Criterion): CheckResult {
  const table = parseTable(markdown);

  if (table === null) {
    return {
      criterion: criterion.check,
      pass: false,
      message: 'No table found in content.',
    };
  }

  const requiredColumns = criterion.columns;
  if (requiredColumns && requiredColumns.length > 0) {
    const lowerActual = table.columns.map((c) => c.toLowerCase());
    const missing = requiredColumns.filter(
      (col) => !lowerActual.includes(col.toLowerCase()),
    );
    if (missing.length > 0) {
      return {
        criterion: criterion.check,
        pass: false,
        message: `Table is missing required columns: ${missing.join(', ')}.`,
      };
    }
  }

  return {
    criterion: criterion.check,
    pass: true,
    message: `Table found with columns: ${table.columns.join(', ')}.`,
  };
}
