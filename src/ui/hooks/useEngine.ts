// src/ui/hooks/useEngine.ts
import { useReducer, useEffect, useRef, useCallback } from 'react';
import type { TypedEmitter, SisyphusEvents } from '../../events.js';
import { uiReducer, initialUIState } from '../state.js';
import type { UIState } from '../state.js';

const EVENT_NAMES: Array<keyof SisyphusEvents & string> = [
  'run:start',
  'run:end',
  'boulder:start',
  'boulder:end',
  'stack:start',
  'stack:file',
  'stack:end',
  'produce:start',
  'produce:file-change',
  'produce:diff',
  'produce:stream',
  'produce:thinking',
  'produce:end',
  'evaluate:start',
  'evaluate:structural',
  'evaluate:custom',
  'evaluate:end',
  'climb',
];

/** Events that arrive in rapid bursts and should be batched */
const BATCH_EVENTS = new Set<string>(['produce:stream']);
const BATCH_FLUSH_MS = 50;

export function useEngine(emitter: TypedEmitter<SisyphusEvents>): UIState {
  const [state, dispatch] = useReducer(uiReducer, initialUIState);
  const streamBufferRef = useRef<string[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushStreamBuffer = useCallback(() => {
    flushTimerRef.current = null;
    if (streamBufferRef.current.length === 0) return;
    const lines = streamBufferRef.current;
    streamBufferRef.current = [];
    dispatch({ type: 'produce:stream-batch', payload: { lines } } as any);
  }, []);

  useEffect(() => {
    const handlers = new Map<string, (payload: unknown) => void>();

    for (const eventName of EVENT_NAMES) {
      if (BATCH_EVENTS.has(eventName)) {
        // Buffer rapid events and flush periodically
        const handler = (payload: unknown) => {
          const p = payload as { line: string };
          streamBufferRef.current.push(p.line);
          if (flushTimerRef.current === null) {
            flushTimerRef.current = setTimeout(flushStreamBuffer, BATCH_FLUSH_MS);
          }
        };
        handlers.set(eventName, handler);
        emitter.on(eventName, handler as any);
      } else {
        const handler = (payload: unknown) => {
          // Flush any pending stream lines before a non-stream event
          // to maintain correct ordering (e.g., produce:end after all lines)
          if (streamBufferRef.current.length > 0) {
            if (flushTimerRef.current !== null) {
              clearTimeout(flushTimerRef.current);
              flushTimerRef.current = null;
            }
            const lines = streamBufferRef.current;
            streamBufferRef.current = [];
            dispatch({ type: 'produce:stream-batch', payload: { lines } } as any);
          }
          dispatch({ type: eventName, payload } as any);
        };
        handlers.set(eventName, handler);
        emitter.on(eventName, handler as any);
      }
    }

    return () => {
      for (const [eventName, handler] of handlers) {
        emitter.off(eventName as keyof SisyphusEvents & string, handler as any);
      }
      if (flushTimerRef.current !== null) {
        clearTimeout(flushTimerRef.current);
      }
    };
  }, [emitter, flushStreamBuffer]);

  return state;
}
