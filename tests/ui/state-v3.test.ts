import { describe, it, expect } from 'vitest';
import { uiReducer, initialUIState } from '../../src/ui/state.js';
import type { UIState, UIAction } from '../../src/ui/state.js';

function apply(state: UIState, action: UIAction): UIState {
  return uiReducer(state, action);
}

describe('produce:stream action', () => {
  it('appends a line to streamingLines', () => {
    let state = apply(initialUIState, {
      type: 'run:start',
      payload: { title: 'T', layer: 'l', totalBoulders: 1, maxRetries: 3 },
    });
    state = apply(state, {
      type: 'boulder:start',
      payload: { name: 'b1', index: 0, total: 1, maxAttempts: 3 },
    });
    state = apply(state, {
      type: 'produce:start',
      payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
    });
    state = apply(state, {
      type: 'produce:stream',
      payload: { boulderName: 'b1', line: '# Welcome' },
    });
    expect(state.agentPanel.streamingLines).toContain('# Welcome');
  });
});

describe('agentPanel state management', () => {
  function makeBoulder(): UIState {
    return apply(
      apply(initialUIState, {
        type: 'run:start',
        payload: { title: 'T', layer: 'l', totalBoulders: 1, maxRetries: 3 },
      }),
      { type: 'boulder:start', payload: { name: 'b1', index: 0, total: 1, maxAttempts: 3 } },
    );
  }

  it('produce:start sets agentPanel to sisyphus with empty streamingLines', () => {
    let state = makeBoulder();
    state = apply(state, {
      type: 'produce:start',
      payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
    });
    expect(state.agentPanel.agent).toBe('sisyphus');
    expect(state.agentPanel.streamingLines).toEqual([]);
    expect(state.agentPanel.boulderName).toBe('b1');
    expect(state.agentPanel.attempt).toBe(0);
  });

  it('produce:stream appends lines', () => {
    let state = makeBoulder();
    state = apply(state, {
      type: 'produce:start',
      payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
    });
    state = apply(state, {
      type: 'produce:stream',
      payload: { boulderName: 'b1', line: '# Hello' },
    });
    state = apply(state, {
      type: 'produce:stream',
      payload: { boulderName: 'b1', line: 'World' },
    });
    expect(state.agentPanel.streamingLines).toEqual(['# Hello', 'World']);
  });

  it('evaluate:start switches agentPanel to hades', () => {
    let state = makeBoulder();
    state = apply(state, {
      type: 'produce:start',
      payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
    });
    state = apply(state, {
      type: 'evaluate:start',
      payload: { boulderName: 'b1', attempt: 0, structuralCount: 2, customCount: 1 },
    });
    expect(state.agentPanel.agent).toBe('hades');
    expect(state.agentPanel.streamingLines).toEqual([]);
  });

  it('climb sets agentPanel to retry mode with failure info', () => {
    let state = makeBoulder();
    state = apply(state, {
      type: 'produce:start',
      payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
    });
    state = apply(state, {
      type: 'evaluate:start',
      payload: { boulderName: 'b1', attempt: 0, structuralCount: 0, customCount: 0 },
    });
    state = apply(state, {
      type: 'evaluate:end',
      payload: {
        boulderName: 'b1', attempt: 0, passed: false,
        failures: [{ criterion: 'word-count', pass: false, message: 'Too short' }],
      },
    });
    state = apply(state, {
      type: 'climb',
      payload: {
        boulderName: 'b1', attempt: 0,
        failures: [{ criterion: 'word-count', pass: false, message: 'Too short' }],
      },
    });
    expect(state.agentPanel.agent).toBe('retry');
    expect(state.agentPanel.climbFeedback).toContain('Too short');
  });

  it('stack:start sets agentPanel to gathering mode', () => {
    let state = makeBoulder();
    state = apply(state, {
      type: 'stack:start',
      payload: { boulderName: 'b1', sourceCount: 3 },
    });
    expect(state.agentPanel.agent).toBe('gathering');
    expect(state.agentPanel.boulderName).toBe('b1');
  });

  it('run:end sets agentPanel to done', () => {
    const mockReport = {
      title: 'T', startedAt: '', completedAt: '',
      boulders: [], totalBoulders: 0, passedClean: 0, passedAfterClimb: 0, flagged: 0,
    };
    let state = makeBoulder();
    state = apply(state, { type: 'run:end', payload: { report: mockReport } });
    expect(state.agentPanel.agent).toBe('done');
  });
});
