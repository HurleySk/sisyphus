import { describe, it, expect, afterEach, vi } from 'vitest';

vi.setConfig({ testTimeout: 15_000 });
import React from 'react';
import { render, cleanup } from 'ink-testing-library';
import { StatusBar, computeLayout } from '../../src/ui/components/StatusBar.js';
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

  it('collapses pending when badges overflow terminal width', () => {
    const completed: CompletedBoulder[] = [
      { name: 'alpha', status: 'passed', attempts: 1, durationMs: 5000 },
    ];
    const pending = Array.from({ length: 8 }, (_, i) => `boulder-${i}`);
    // Width: completed(14) + active(~16) + collapsed pending(14) = ~44
    // Must be wide enough for level 1 but not level 0 (which needs ~150)
    const out = cap(<StatusBar completed={completed} boulderElapsed={3} activeBoulderName="current" pendingNames={pending} total={10} elapsed={20} columns={60} activePhase={null} />);
    expect(out).toContain('+8 pending');
    // Completed should still be shown individually
    expect(out).toContain('alpha');
  });

  it('collapses both completed and pending when very narrow', () => {
    const completed: CompletedBoulder[] = Array.from({ length: 5 }, (_, i) => ({
      name: `done-${i}`, status: 'passed' as const, attempts: 1, durationMs: 3000,
    }));
    const pending = Array.from({ length: 5 }, (_, i) => `todo-${i}`);
    const out = cap(<StatusBar completed={completed} boulderElapsed={2} activeBoulderName="active" pendingNames={pending} total={11} elapsed={30} columns={40} activePhase={null} />);
    expect(out).toContain('5✓');
    expect(out).toContain('+5 pending');
    // Individual completed names should NOT appear
    expect(out).not.toContain('done-0');
  });
});

describe('computeLayout', () => {
  function makeBoulder(name: string, durationMs = 3000): CompletedBoulder {
    return { name, status: 'passed', attempts: 1, durationMs };
  }

  it('level 0: shows all badges when they fit', () => {
    const completed = [makeBoulder('a')];
    const layout = computeLayout(completed, 'b', null, 0, ['c'], 200);
    expect(layout.collapsedCompleted).toBeNull();
    expect(layout.collapsedPending).toBeNull();
    expect(layout.completedBadges).toHaveLength(1);
    expect(layout.pendingBadges).toEqual(['c']);
    expect(layout.showActive).toBe(true);
  });

  it('level 1: collapses pending when too wide', () => {
    const completed = [makeBoulder('alpha')];
    const pending = Array.from({ length: 10 }, (_, i) => `pending-${i}`);
    // Total pending width: 10 badges * ~14 chars each = ~140
    // Give enough for completed + active but not pending
    const layout = computeLayout(completed, 'active', null, 5, pending, 50);
    expect(layout.collapsedPending).toBe(10);
    expect(layout.pendingBadges).toEqual([]);
    // completed still individual
    expect(layout.collapsedCompleted).toBeNull();
    expect(layout.completedBadges).toHaveLength(1);
  });

  it('level 2: collapses both completed and pending', () => {
    const completed = Array.from({ length: 5 }, (_, i) => makeBoulder(`done-${i}`));
    const pending = Array.from({ length: 5 }, (_, i) => `todo-${i}`);
    const layout = computeLayout(completed, 'active', 'producing', 10, pending, 40);
    expect(layout.collapsedCompleted).toBe(5);
    expect(layout.completedBadges).toEqual([]);
    expect(layout.collapsedPending).toBe(5);
    expect(layout.pendingBadges).toEqual([]);
    expect(layout.showActive).toBe(true);
  });

  it('returns no collapse markers for empty groups', () => {
    const layout = computeLayout([], 'only', null, 0, [], 200);
    expect(layout.collapsedCompleted).toBeNull();
    expect(layout.collapsedPending).toBeNull();
    expect(layout.showActive).toBe(true);
  });

  it('handles no active boulder', () => {
    const completed = [makeBoulder('a'), makeBoulder('b')];
    const layout = computeLayout(completed, null, null, 0, [], 200);
    expect(layout.showActive).toBe(false);
    expect(layout.completedBadges).toHaveLength(2);
  });
});
