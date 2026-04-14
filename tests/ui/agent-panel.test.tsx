import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from 'ink-testing-library';
import { AgentHeader } from '../../src/ui/components/AgentHeader.js';

afterEach(() => { cleanup(); });

function cap(el: React.ReactElement): string {
  const { lastFrame } = render(el);
  return lastFrame()!;
}

describe('AgentHeader', () => {
  it('renders SISYPHUS with boulder name and attempt', () => {
    const out = cap(<AgentHeader agent="sisyphus" boulderName="greeting" attempt={0} maxAttempts={3} elapsed={6} />);
    expect(out).toContain('SISYPHUS');
    expect(out).toContain('greeting');
    expect(out).toContain('attempt 1');
    expect(out).toContain('6s');
  });

  it('renders HADES with evaluating label', () => {
    const out = cap(<AgentHeader agent="hades" boulderName="features" attempt={0} maxAttempts={3} elapsed={3} />);
    expect(out).toContain('HADES');
    expect(out).toContain('features');
    expect(out).toContain('evaluating');
  });

  it('renders GATHERING with dim cyan style', () => {
    const out = cap(<AgentHeader agent="gathering" boulderName="intro" attempt={0} maxAttempts={3} elapsed={2} />);
    expect(out).toContain('GATHERING');
    expect(out).toContain('intro');
  });

  it('renders RETRY with attempt number', () => {
    const out = cap(<AgentHeader agent="retry" boulderName="features" attempt={1} maxAttempts={3} elapsed={0} />);
    expect(out).toContain('RETRY');
    expect(out).toContain('features');
    expect(out).toContain('attempt 2');
  });

  it('renders DONE header', () => {
    const out = cap(<AgentHeader agent="done" boulderName={null} attempt={0} maxAttempts={0} elapsed={28} />);
    expect(out).toContain('DONE');
  });
});
