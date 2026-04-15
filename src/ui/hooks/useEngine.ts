// src/ui/hooks/useEngine.ts
import { useReducer, useEffect, useRef, useCallback } from 'react';
import type { TypedEmitter, SisyphusEvents } from '../../events.js';
import { uiReducer, initialUIState } from '../state.js';
import type { UIState, UIAction } from '../state.js';

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

  // Single controlled cast point — event names are dynamic strings at runtime,
  // so TypeScript cannot narrow to specific UIAction variants in a loop.
  const emit = useCallback(
    (type: string, payload: unknown) => dispatch({ type, payload } as UIAction),
    [],
  );

  const flushStreamBuffer = useCallback(() => {
    flushTimerRef.current = null;
    if (streamBufferRef.current.length === 0) return;
    const lines = streamBufferRef.current;
    streamBufferRef.current = [];
    emit('produce:stream-batch', { lines });
  }, [emit]);

  useEffect(() => {
    type Handler = (payload: unknown) => void;
    const handlers = new Map<string, Handler>();

    for (const eventName of EVENT_NAMES) {
      if (BATCH_EVENTS.has(eventName)) {
        // Buffer rapid events and flush periodically
        const handler: Handler = (payload) => {
          const p = payload as { line: string };
          streamBufferRef.current.push(p.line);
          if (flushTimerRef.current === null) {
            flushTimerRef.current = setTimeout(flushStreamBuffer, BATCH_FLUSH_MS);
          }
        };
        handlers.set(eventName, handler);
        (emitter as any).on(eventName, handler);
      } else {
        const handler: Handler = (payload) => {
          // Flush any pending stream lines before a non-stream event
          // to maintain correct ordering (e.g., produce:end after all lines)
          if (streamBufferRef.current.length > 0) {
            if (flushTimerRef.current !== null) {
              clearTimeout(flushTimerRef.current);
              flushTimerRef.current = null;
            }
            const lines = streamBufferRef.current;
            streamBufferRef.current = [];
            emit('produce:stream-batch', { lines });
          }
          emit(eventName, payload);
        };
        handlers.set(eventName, handler);
        (emitter as any).on(eventName, handler);
      }
    }

    return () => {
      for (const [eventName, handler] of handlers) {
        (emitter as any).off(eventName, handler);
      }
      if (flushTimerRef.current !== null) {
        clearTimeout(flushTimerRef.current);
      }
    };
  }, [emitter, flushStreamBuffer]);

  return state;
}
