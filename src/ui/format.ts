import type { CompletedBoulder } from './state.js';

export function boulderStatusStyle(b: CompletedBoulder): { icon: string; color: string } {
  if (b.status === 'flagged') return { icon: '✗', color: 'red' };
  if (b.attempts > 1) return { icon: '✓', color: 'yellow' };
  return { icon: '✓', color: 'green' };
}

/**
 * Slice items to fit a viewport, keeping the most recent (tail) items visible.
 * Returns the visible slice and how many items overflowed above.
 */
export function sliceViewport<T>(items: T[], viewportHeight: number, reserveLines = 2): { visible: T[]; overflowCount: number } {
  const budget = Math.max(viewportHeight - reserveLines, 3);
  if (items.length <= budget) return { visible: items, overflowCount: 0 };
  const maxItems = budget - 1; // reserve 1 line for overflow indicator
  return { visible: items.slice(-maxItems), overflowCount: items.length - maxItems };
}

export function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function formatDuration(ms: number): string {
  return formatElapsed(Math.floor(ms / 1000));
}
