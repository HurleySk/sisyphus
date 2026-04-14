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
