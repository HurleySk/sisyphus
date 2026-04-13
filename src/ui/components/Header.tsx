import React from 'react';
import { Box, Text } from 'ink';

interface HeaderProps { title: string; layer: string; elapsed: number; }

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function Header({ title, layer, elapsed }: HeaderProps) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">⚡ Sisyphus — {title}</Text>
      <Text dimColor>{layer} · {formatElapsed(elapsed)}</Text>
    </Box>
  );
}
