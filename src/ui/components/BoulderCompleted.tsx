import React from 'react';
import { Box, Text } from 'ink';
import type { CheckResult } from '../../types.js';

interface BoulderCompletedProps {
  name: string;
  status: 'passed' | 'flagged';
  attempts: number;
  durationMs: number;
  failures?: CheckResult[];
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function BoulderCompleted({ name, status, attempts, durationMs, failures }: BoulderCompletedProps) {
  const icon = status === 'flagged' ? '✗' : '✓';
  const iconColor = status === 'flagged' ? 'red' : attempts > 1 ? 'yellow' : 'green';
  const statusLabel = status === 'flagged' ? 'flagged' : attempts > 1 ? `passed after ${attempts} attempts` : 'passed';

  return (
    <Box flexDirection="column">
      <Text>
        <Text color={iconColor}>{icon}</Text>{' '}<Text bold>{name}</Text>{' '}
        <Text dimColor>— {statusLabel} · {formatDuration(durationMs)}</Text>
      </Text>
      {attempts > 1 && failures && failures.length > 0 && (
        <Text dimColor>    attempt 1: {failures.map(f => f.criterion).join(', ')}</Text>
      )}
    </Box>
  );
}
