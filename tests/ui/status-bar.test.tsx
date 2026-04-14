import { describe, it, expect, afterEach, vi } from 'vitest';

vi.setConfig({ testTimeout: 15_000 });
import React from 'react';
import { render, cleanup } from 'ink-testing-library';
import { StatusBar } from '../../src/ui/components/StatusBar.js';
import type { CompletedBoulder } from '../../src/ui/state.js';

afterEach(() => { cleanup(); });

function cap(el: React.ReactElement): string {
  const { lastFrame } = render(el);
  return lastFrame()!;
}

describe('StatusBar', () => {
  it('renders completed boulder with green checkmark and time', () => {
    const completed: CompletedBoulder[] = [
      { name: 'greeting', status: 'passed', attempts: 1, durationMs: 9000 },
    ];
    const out = cap(<StatusBar completed={completed} boulderElapsed={0} activeBoulderName="features" pendingNames={['summary']} total={3} elapsed={14} />);
    expect(out).toContain('✓');
    expect(out).toContain('greeting');
    expect(out).toContain('9s');
  });

  it('renders active boulder with cyan bullet', () => {
    const out = cap(<StatusBar completed={[]} boulderElapsed={0} activeBoulderName="features" pendingNames={[]} total={2} elapsed={5} />);
    expect(out).toContain('●');
    expect(out).toContain('features');
  });

  it('renders pending boulder with dim circle', () => {
    const out = cap(<StatusBar completed={[]} boulderElapsed={0} activeBoulderName="greeting" pendingNames={['features', 'summary']} total={3} elapsed={2} />);
    expect(out).toContain('○');
    expect(out).toContain('features');
  });

  it('renders progress bar and count', () => {
    const completed: CompletedBoulder[] = [
      { name: 'greeting', status: 'passed', attempts: 1, durationMs: 9000 },
    ];
    const out = cap(<StatusBar completed={completed} boulderElapsed={0} activeBoulderName="features" pendingNames={[]} total={2} elapsed={14} />);
    expect(out).toContain('1/2');
    expect(out).toContain('14s');
  });

  it('shows yellow checkmark for climbed boulder', () => {
    const completed: CompletedBoulder[] = [
      { name: 'features', status: 'passed', attempts: 2, durationMs: 19000 },
    ];
    const out = cap(<StatusBar completed={completed} boulderElapsed={0} activeBoulderName={null} pendingNames={[]} total={1} elapsed={19} />);
    expect(out).toContain('✓');
    expect(out).toContain('features');
    expect(out).toContain('19s');
  });

  it('shows red X for flagged boulder', () => {
    const completed: CompletedBoulder[] = [
      { name: 'features', status: 'flagged', attempts: 3, durationMs: 30000 },
    ];
    const out = cap(<StatusBar completed={completed} boulderElapsed={0} activeBoulderName={null} pendingNames={[]} total={1} elapsed={30} />);
    expect(out).toContain('✗');
    expect(out).toContain('features');
  });
});
