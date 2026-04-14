// tests/events.test.ts
import { describe, it, expect, vi } from 'vitest';
import { TypedEmitter } from '../src/events.js';
import type { SisyphusEvents } from '../src/events.js';

describe('TypedEmitter', () => {
  it('emits and receives typed events', () => {
    const emitter = new TypedEmitter<SisyphusEvents>();
    const handler = vi.fn();

    emitter.on('run:start', handler);
    emitter.emit('run:start', {
      title: 'Test Run',
      layer: 'documentation',
      totalBoulders: 3,
      maxRetries: 3,
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      title: 'Test Run',
      layer: 'documentation',
      totalBoulders: 3,
      maxRetries: 3,
    });
  });

  it('supports multiple listeners on the same event', () => {
    const emitter = new TypedEmitter<SisyphusEvents>();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    emitter.on('boulder:start', handler1);
    emitter.on('boulder:start', handler2);
    emitter.emit('boulder:start', { name: 'test', index: 0, total: 1, maxAttempts: 4, description: 'test boulder', criteriaDescriptions: [] });

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('removes listeners with off()', () => {
    const emitter = new TypedEmitter<SisyphusEvents>();
    const handler = vi.fn();

    emitter.on('run:end', handler);
    emitter.off('run:end', handler);
    emitter.emit('run:end', { report: {} as any });

    expect(handler).not.toHaveBeenCalled();
  });

  it('does not throw when emitting with no listeners', () => {
    const emitter = new TypedEmitter<SisyphusEvents>();
    expect(() => {
      emitter.emit('run:start', { title: 'T', layer: 'l', totalBoulders: 1, maxRetries: 3 });
    }).not.toThrow();
  });
});
