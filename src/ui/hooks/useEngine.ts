// src/ui/hooks/useEngine.ts
import { useReducer, useEffect } from 'react';
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

export function useEngine(emitter: TypedEmitter<SisyphusEvents>): UIState {
  const [state, dispatch] = useReducer(uiReducer, initialUIState);

  useEffect(() => {
    const handlers = new Map<string, (payload: unknown) => void>();

    for (const eventName of EVENT_NAMES) {
      const handler = (payload: unknown) => {
        dispatch({ type: eventName, payload } as any);
      };
      handlers.set(eventName, handler);
      emitter.on(eventName, handler as any);
    }

    return () => {
      for (const [eventName, handler] of handlers) {
        emitter.off(eventName as keyof SisyphusEvents & string, handler as any);
      }
    };
  }, [emitter]);

  return state;
}
