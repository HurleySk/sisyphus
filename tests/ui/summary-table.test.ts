import { describe, it, expect } from 'vitest';
import { formatSummary } from '../../src/ui/components/SummaryTable.js';
import type { RunReport } from '../../src/types.js';

describe('formatSummary', () => {
  it('formats a run report as a table', () => {
    const report: RunReport = {
      title: 'Test', startedAt: '', completedAt: '', totalBoulders: 3,
      passedClean: 1, passedAfterClimb: 1, flagged: 1,
      boulders: [
        { name: 'intro', content: '', attempts: 1, status: 'passed' },
        { name: 'mapping', content: '', attempts: 2, status: 'passed' },
        { name: 'risks', content: '', attempts: 4, status: 'flagged',
          failures: [{ criterion: 'word-count', pass: false, message: 'short' }] },
      ],
    };
    const output = formatSummary(report, 'out.md', 'out-report.json');
    expect(output).toContain('intro');
    expect(output).toContain('mapping');
    expect(output).toContain('risks');
    expect(output).toContain('pass');
    expect(output).toContain('flag');
    expect(output).toContain('out.md');
  });

  it('handles all-pass report', () => {
    const report: RunReport = {
      title: 'Clean', startedAt: '', completedAt: '', totalBoulders: 1,
      passedClean: 1, passedAfterClimb: 0, flagged: 0,
      boulders: [{ name: 'only', content: '', attempts: 1, status: 'passed' }],
    };
    const output = formatSummary(report, 'x.md', 'x-report.json');
    expect(output).toContain('1 passed');
    expect(output).not.toContain('flagged');
  });
});
