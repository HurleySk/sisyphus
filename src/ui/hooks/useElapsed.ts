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

