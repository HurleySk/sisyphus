import type { CheckFn } from '../../../src/types.js';
import { containsTable } from './contains-table.js';
import { rowCountGte, rowCountLte } from './row-count.js';
import { containsHeading } from './contains-heading.js';
import { wordCountGte, wordCountLte } from './word-count.js';

export function getDocumentationChecks(): Map<string, CheckFn> {
  return new Map([
    ['contains-table', containsTable],
    ['row-count-gte', rowCountGte],
    ['row-count-lte', rowCountLte],
    ['contains-heading', containsHeading],
    ['word-count-gte', wordCountGte],
    ['word-count-lte', wordCountLte],
  ]);
}

export { containsTable, parseTable } from './contains-table.js';
export { rowCountGte, rowCountLte } from './row-count.js';
export { containsHeading } from './contains-heading.js';
export { wordCountGte, wordCountLte } from './word-count.js';
