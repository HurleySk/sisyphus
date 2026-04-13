import React from 'react';
import { Box, Text } from 'ink';

interface FooterProps { completed: number; total: number; elapsed: number; }

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function Footer({ completed, total, elapsed }: FooterProps) {
  return (
    <Box marginTop={1}>
      <Text dimColor>{completed}/{total} boulders · {formatElapsed(elapsed)}</Text>
    </Box>
  );
}
