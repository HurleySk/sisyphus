import { describe, it, expect } from 'vitest';
import { filterLessons, formatLessonsForPrompt } from '../src/lessons.js';
import type { Lesson } from '../src/types.js';

const sampleLessons: Lesson[] = [
  { id: 'L1', text: 'Always check row counts against source data', source: 'auto', layer: 'documentation', created: '2026-04-01', lastUsed: '2026-04-10', useCount: 5, relevance: ['row-count', 'criteria'] },
  { id: 'L2', text: 'Tables need complete column coverage', source: 'user', layer: 'documentation', created: '2026-04-05', lastUsed: '2026-04-08', useCount: 2, relevance: ['contains-table', 'columns'] },
  { id: 'L3', text: 'Keep prompts under 4000 tokens', source: 'auto', created: '2026-03-01', lastUsed: '2026-03-15', useCount: 1, relevance: ['prompt', 'tokens'] },
];

describe('filterLessons', () => {
  it('filters by relevance tags', () => {
    const result = filterLessons(sampleLessons, ['row-count']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('L1');
  });

  it('returns all when no tags specified', () => {
    const result = filterLessons(sampleLessons, []);
    expect(result).toHaveLength(3);
  });

  it('returns all when no tags match', () => {
    const result = filterLessons(sampleLessons, ['nonexistent-tag']);
    expect(result).toHaveLength(3);
  });

  it('sorts by useCount descending', () => {
    const result = filterLessons(sampleLessons, []);
    expect(result[0].useCount).toBe(5);
    expect(result[1].useCount).toBe(2);
    expect(result[2].useCount).toBe(1);
  });

  it('sorts by lastUsed descending when useCount is equal', () => {
    const tiedLessons: Lesson[] = [
      { id: 'A', text: 'Older lesson', source: 'auto', created: '2026-01-01', lastUsed: '2026-04-01', useCount: 3, relevance: [] },
      { id: 'B', text: 'Newer lesson', source: 'auto', created: '2026-01-01', lastUsed: '2026-04-10', useCount: 3, relevance: [] },
    ];
    const result = filterLessons(tiedLessons, []);
    expect(result[0].id).toBe('B');
    expect(result[1].id).toBe('A');
  });

  it('returns matching lessons from multiple tags (union)', () => {
    const result = filterLessons(sampleLessons, ['row-count', 'contains-table']);
    expect(result).toHaveLength(2);
    const ids = result.map(l => l.id);
    expect(ids).toContain('L1');
    expect(ids).toContain('L2');
  });
});

describe('formatLessonsForPrompt', () => {
  it('formats as numbered list', () => {
    const lessons = sampleLessons.slice(0, 2);
    const result = formatLessonsForPrompt(lessons);
    expect(result).toBe(
      '1. Always check row counts against source data\n2. Tables need complete column coverage'
    );
  });

  it('respects budget by limiting count', () => {
    // Each lesson text is roughly 40-50 chars; set budget to only fit one
    const budget = 50;
    const result = formatLessonsForPrompt(sampleLessons, budget);
    // Should only contain the first lesson
    expect(result).toContain('1.');
    expect(result).not.toContain('2.');
  });

  it('returns empty string for no lessons', () => {
    expect(formatLessonsForPrompt([])).toBe('');
  });

  it('uses default budget of 2000 chars', () => {
    // All sample lessons combined are well under 2000 chars
    const result = formatLessonsForPrompt(sampleLessons);
    expect(result).toContain('1.');
    expect(result).toContain('2.');
    expect(result).toContain('3.');
  });
});
