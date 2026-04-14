import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from 'ink-testing-library';
import { AgentHeader } from '../../src/ui/components/AgentHeader.js';
import { AgentPanel } from '../../src/ui/components/AgentPanel.js';
import { StatusBar } from '../../src/ui/components/StatusBar.js';
import { CompletionSummary } from '../../src/ui/components/CompletionSummary.js';
import { ProgressBar } from '../../src/ui/components/ProgressBar.js';
import { defaultAgentPanel } from '../../src/ui/state.js';
import type { RunReport } from '../../src/types.js';

afterEach(() => { cleanup(); });

function cap(el: React.ReactElement): string {
  const { lastFrame } = render(el);
  return lastFrame()!;
}

describe('ProgressBar', () => {
  it('renders filled and empty sections', () => {
    const out = cap(<ProgressBar completed={1} total={2} width={10} />);
    expect(out).toContain('━');
  });
});

describe('AgentHeader', () => {
  it('renders agent name and boulder', () => {
    const out = cap(<AgentHeader agent="sisyphus" boulderName="intro" attempt={0} maxAttempts={3} elapsed={5} />);
    expect(out).toContain('SISYPHUS');
    expect(out).toContain('intro');
  });
});

describe('AgentPanel integration', () => {
  it('shows waiting when idle', () => {
    const out = cap(<AgentPanel panel={defaultAgentPanel} elapsed={0} />);
    expect(out).toContain('waiting');
  });
});

describe('StatusBar integration', () => {
  it('renders boulder badges and progress', () => {
    const out = cap(
      <StatusBar
        completed={[{ name: 'done', status: 'passed', attempts: 1, durationMs: 5000 }]}
        activeBoulderName="active"
        pendingNames={['next']}
        total={3}
        elapsed={10}
      />
    );
    expect(out).toContain('done');
    expect(out).toContain('active');
    expect(out).toContain('next');
    expect(out).toContain('1/3');
  });
});

describe('CompletionSummary integration', () => {
  it('renders done with boulder details', () => {
    const report: RunReport = {
      title: 'T', startedAt: '', completedAt: '',
      boulders: [{ name: 'b1', content: '', attempts: 1, status: 'passed' }],
      totalBoulders: 1, passedClean: 1, passedAfterClimb: 0, flagged: 0,
    };
    const out = cap(
      <CompletionSummary
        report={report}
        completedBoulders={[{ name: 'b1', status: 'passed', attempts: 1, durationMs: 5000 }]}
        artifactPath="/out/a.md"
        reportPath="/out/r.json"
        elapsed={5}
      />
    );
    expect(out).toContain('DONE');
    expect(out).toContain('b1');
    expect(out).toContain('/out/a.md');
  });
});
