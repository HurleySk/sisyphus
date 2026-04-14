import { describe, it, expect } from 'vitest';
import { uiReducer, initialUIState } from '../../src/ui/state.js';
import type { UIAction } from '../../src/ui/state.js';
import type { RunReport } from '../../src/types.js';

// Helper to apply a sequence of actions to state
function applyActions(actions: UIAction[]) {
  return actions.reduce(uiReducer, initialUIState);
}

describe('event-to-state integration', () => {
  it('processes a full successful boulder lifecycle', () => {
    const mockReport: RunReport = {
      title: 'Test Spec',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      totalBoulders: 1,
      passedClean: 1,
      passedAfterClimb: 0,
      flagged: 0,
      boulders: [
        {
          name: 'My Boulder',
          status: 'passed',
          attempts: 1,
          content: '',
        },
      ],
    };

    const actions: UIAction[] = [
      { type: 'run:start', payload: { title: 'Test Spec', layer: 'documentation', totalBoulders: 1, maxRetries: 3 } },
      { type: 'boulder:start', payload: { name: 'My Boulder', index: 0, total: 1, maxAttempts: 3, description: 'test boulder', criteriaDescriptions: ['check 1'] } },
      { type: 'stack:start', payload: { boulderName: 'My Boulder', sourceCount: 2 } as any },
      { type: 'stack:file', payload: { boulderName: 'My Boulder', filePath: 'src/foo.ts', lineCount: 100, summarized: false } },
      { type: 'stack:end', payload: { boulderName: 'My Boulder', resultCount: 1 } as any },
      { type: 'produce:start', payload: { boulderName: 'My Boulder', attempt: 0, maxAttempts: 3 } },
      { type: 'produce:end', payload: { boulderName: 'My Boulder', attempt: 0, outputLength: 1000 } as any },
      { type: 'evaluate:start', payload: { boulderName: 'My Boulder', attempt: 0, structuralCount: 2, customCount: 1 } as any },
      {
        type: 'evaluate:structural',
        payload: {
          boulderName: 'My Boulder',
          results: [
            { criterion: 'has-intro', pass: true, message: 'OK' },
          ],
        },
      },
      {
        type: 'evaluate:end',
        payload: {
          boulderName: 'My Boulder',
          attempt: 0,
          passed: true,
          failures: [],
        },
      },
      {
        type: 'boulder:end',
        payload: {
          name: 'My Boulder',
          status: 'passed',
          attempts: 1,
          durationMs: 4000,
        },
      },
      { type: 'run:end', payload: { report: mockReport } },
    ];

    const finalState = applyActions(actions);

    expect(finalState.completedBoulders).toHaveLength(1);
    expect(finalState.completedBoulders[0].name).toBe('My Boulder');
    expect(finalState.completedBoulders[0].status).toBe('passed');
    expect(finalState.completedBoulders[0].attempts).toBe(1);
    expect(finalState.activeBoulder).toBeNull();
    expect(finalState.report).toBe(mockReport);
  });

  it('processes a climb retry sequence', () => {
    const mockReport: RunReport = {
      title: 'Test Spec',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      totalBoulders: 1,
      passedClean: 0,
      passedAfterClimb: 1,
      flagged: 0,
      boulders: [
        {
          name: 'Retry Boulder',
          status: 'passed',
          attempts: 2,
          content: '',
        },
      ],
    };

    const actions: UIAction[] = [
      { type: 'run:start', payload: { title: 'Test Spec', layer: 'documentation', totalBoulders: 1, maxRetries: 3 } },
      { type: 'boulder:start', payload: { name: 'Retry Boulder', index: 0, total: 1, maxAttempts: 3, description: 'retry boulder', criteriaDescriptions: [] } },
      { type: 'stack:start', payload: { boulderName: 'Retry Boulder', sourceCount: 1 } as any },
      { type: 'stack:end', payload: { boulderName: 'Retry Boulder', resultCount: 1 } as any },
      // First attempt
      { type: 'produce:start', payload: { boulderName: 'Retry Boulder', attempt: 0, maxAttempts: 3 } },
      { type: 'produce:end', payload: { boulderName: 'Retry Boulder', attempt: 0, outputLength: 500 } as any },
      { type: 'evaluate:start', payload: { boulderName: 'Retry Boulder', attempt: 0, structuralCount: 1, customCount: 0 } as any },
      {
        type: 'evaluate:structural',
        payload: {
          boulderName: 'Retry Boulder',
          results: [{ criterion: 'has-summary', pass: false, message: 'Missing summary section' }],
        },
      },
      {
        type: 'evaluate:end',
        payload: {
          boulderName: 'Retry Boulder',
          attempt: 0,
          passed: false,
          failures: [{ criterion: 'has-summary', pass: false, message: 'Missing summary section' }],
        },
      },
      // Climb
      {
        type: 'climb',
        payload: {
          boulderName: 'Retry Boulder',
          attempt: 0,
          failures: [{ criterion: 'has-summary', pass: false, message: 'Missing summary section' }],
        },
      },
      // Second attempt
      {
        type: 'produce:start',
        payload: { boulderName: 'Retry Boulder', attempt: 1, maxAttempts: 3, climbFeedback: 'Add summary section' },
      },
      { type: 'produce:end', payload: { boulderName: 'Retry Boulder', attempt: 1, outputLength: 800 } as any },
      { type: 'evaluate:start', payload: { boulderName: 'Retry Boulder', attempt: 1, structuralCount: 1, customCount: 0 } as any },
      {
        type: 'evaluate:structural',
        payload: {
          boulderName: 'Retry Boulder',
          results: [{ criterion: 'has-summary', pass: true, message: 'OK' }],
        },
      },
      {
        type: 'evaluate:end',
        payload: {
          boulderName: 'Retry Boulder',
          attempt: 1,
          passed: true,
          failures: [],
        },
      },
      {
        type: 'boulder:end',
        payload: {
          name: 'Retry Boulder',
          status: 'passed',
          attempts: 2,
          durationMs: 7000,
        },
      },
      { type: 'run:end', payload: { report: mockReport } },
    ];

    const finalState = applyActions(actions);

    expect(finalState.completedBoulders).toHaveLength(1);
    expect(finalState.completedBoulders[0].name).toBe('Retry Boulder');
    expect(finalState.completedBoulders[0].status).toBe('passed');
    expect(finalState.completedBoulders[0].attempts).toBe(2);
    expect(finalState.activeBoulder).toBeNull();
    expect(finalState.report).toBe(mockReport);
  });
});
