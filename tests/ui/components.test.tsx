import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Header } from '../../src/ui/components/Header.js';
import { Footer } from '../../src/ui/components/Footer.js';
import { BoulderPending } from '../../src/ui/components/BoulderPending.js';
import { BoulderCompleted } from '../../src/ui/components/BoulderCompleted.js';
import { PhaseStack } from '../../src/ui/components/PhaseStack.js';
import { PhaseProduce } from '../../src/ui/components/PhaseProduce.js';
import { PhaseEvaluate } from '../../src/ui/components/PhaseEvaluate.js';
import { FailureDetail } from '../../src/ui/components/FailureDetail.js';
import { BoulderActive } from '../../src/ui/components/BoulderActive.js';
import type { BoulderUIState } from '../../src/ui/state.js';

describe('Header', () => {
  it('renders title and layer', () => {
    const { lastFrame } = render(<Header title="Migration Report" layer="documentation" elapsed={42} />);
    const output = lastFrame()!;
    expect(output).toContain('Migration Report');
    expect(output).toContain('documentation');
    expect(output).toContain('42s');
  });
});

describe('Footer', () => {
  it('renders progress count and elapsed', () => {
    const { lastFrame } = render(<Footer completed={2} total={4} elapsed={30} />);
    const output = lastFrame()!;
    expect(output).toContain('2/4');
    expect(output).toContain('30s');
  });
});

describe('BoulderPending', () => {
  it('renders boulder name', () => {
    const { lastFrame } = render(<BoulderPending name="recommendations" />);
    expect(lastFrame()!).toContain('recommendations');
  });
});

describe('BoulderCompleted', () => {
  it('renders passed boulder with check mark', () => {
    const { lastFrame } = render(
      <BoulderCompleted name="intro" status="passed" attempts={1} durationMs={12000} />
    );
    const output = lastFrame()!;
    expect(output).toContain('✓');
    expect(output).toContain('intro');
    expect(output).toContain('12s');
  });

  it('renders flagged boulder', () => {
    const { lastFrame } = render(
      <BoulderCompleted name="broken" status="flagged" attempts={4} durationMs={120000} />
    );
    const output = lastFrame()!;
    expect(output).toContain('✗');
    expect(output).toContain('broken');
  });

  it('shows climb info when attempts > 1', () => {
    const { lastFrame } = render(
      <BoulderCompleted name="mapping" status="passed" attempts={2} durationMs={48000}
        failures={[{ criterion: 'word-count-gte', pass: false, message: '187/250' }]} />
    );
    const output = lastFrame()!;
    expect(output).toContain('mapping');
    expect(output).toContain('word-count-gte');
  });
});

describe('PhaseStack', () => {
  it('renders file list', () => {
    const files = [
      { path: 'src/data.ts', lines: 42, summarized: false },
      { path: 'data/big.csv', lines: 500, summarized: true },
    ];
    const { lastFrame } = render(<PhaseStack files={files} />);
    const output = lastFrame()!;
    expect(output).toContain('src/data.ts');
    expect(output).toContain('42');
    expect(output).toContain('data/big.csv');
    expect(output).toContain('summarized');
  });
});

describe('PhaseProduce', () => {
  it('renders writing status', () => {
    const { lastFrame } = render(<PhaseProduce elapsed={12} fileChanges={[]} diffStat={null} />);
    expect(lastFrame()!).toContain('writing');
  });

  it('renders climb feedback', () => {
    const { lastFrame } = render(
      <PhaseProduce elapsed={18} climbFeedback="FAIL: word-count" fileChanges={[]} diffStat={null} />
    );
    expect(lastFrame()!).toContain('climbing');
    expect(lastFrame()!).toContain('word-count');
  });

  it('renders file changes', () => {
    const fileChanges = [{ filePath: 'src/risks.ts', changeType: 'M' as const }];
    const { lastFrame } = render(<PhaseProduce elapsed={5} fileChanges={fileChanges} diffStat={null} />);
    expect(lastFrame()!).toContain('src/risks.ts');
  });
});

describe('PhaseEvaluate', () => {
  it('renders structural results', () => {
    const structural = [
      { criterion: 'contains-heading', pass: true, message: 'Found' },
      { criterion: 'word-count-gte', pass: false, message: '187/250' },
    ];
    const { lastFrame } = render(<PhaseEvaluate structuralResults={structural} customResults={[]} />);
    const output = lastFrame()!;
    expect(output).toContain('✓');
    expect(output).toContain('contains-heading');
    expect(output).toContain('✗');
    expect(output).toContain('word-count-gte');
  });
});

describe('FailureDetail', () => {
  it('renders all criteria with pass/fail', () => {
    const results = [
      { criterion: 'heading', pass: true, message: 'Found' },
      { criterion: 'word-count', pass: false, message: '187/250' },
    ];
    const { lastFrame } = render(<FailureDetail results={results} />);
    const output = lastFrame()!;
    expect(output).toContain('heading');
    expect(output).toContain('word-count');
    expect(output).toContain('187/250');
  });
});

describe('BoulderActive', () => {
  it('renders bordered box with name and attempt', () => {
    const boulder: BoulderUIState = {
      name: 'risk-assessment', phase: 'produce', attempt: 1, maxAttempts: 4,
      startedAt: Date.now() - 18000, stackFiles: [], fileChanges: [], diffStat: null,
      climbFeedback: undefined, structuralResults: null, customResults: null, results: null,
    };
    const { lastFrame } = render(<BoulderActive boulder={boulder} />);
    const output = lastFrame()!;
    expect(output).toContain('risk-assessment');
    expect(output).toContain('attempt 2/4');
  });
});
