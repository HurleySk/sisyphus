// src/ui/hooks/useElapsed.ts
import { useState, useEffect } from 'react';

/**
 * Pure utility: returns elapsed whole seconds since startTime.
 */
export function elapsedSeconds(startTime: number): number {
  return Math.floor((Date.now() - startTime) / 1000);
}

/**
 * Single shared tick that re-renders once per second.
 * Use this ONCE in the root component, then compute all elapsed
 * values with elapsedSeconds() to avoid multiple independent intervals.
 */
export function useTick(intervalMs = 1000): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return tick;
}

/**
 * React hook that re-renders every second and returns elapsed seconds
 * since startTime. Returns 0 when startTime is null.
 *
 * NOTE: Each call creates its own setInterval. If you need multiple
 * elapsed values, prefer useTick() + elapsedSeconds() to share one timer.
 */
export function useElapsed(startTime: number | null): number {
  const [elapsed, setElapsed] = useState<number>(
    startTime !== null ? elapsedSeconds(startTime) : 0
  );

  useEffect(() => {
    if (startTime === null) {
      setElapsed(0);
      return;
    }

    // Update immediately in case time passed before the effect ran
    setElapsed(elapsedSeconds(startTime));

    const id = setInterval(() => {
      setElapsed(elapsedSeconds(startTime));
    }, 1000);

    return () => clearInterval(id);
  }, [startTime]);

  return elapsed;
}
