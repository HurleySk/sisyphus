import React from 'react';
import { Box, Text } from 'ink';

interface HeaderProps {
  title: string;
  layer: string;
  elapsed: number;
  completed?: number;
  total?: number;
}

export function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function Header({ title, layer, elapsed, completed, total }: HeaderProps) {
  const showCount = completed != null && total != null;
  return (
    <Box flexDirection="column">
      <Box>
        <Text color="cyan">sisyphus · {layer} · {formatElapsed(elapsed)}</Text>
        {showCount && <Text>{' '.repeat(4)}<Text dimColor>{completed}/{total}</Text></Text>}
      </Box>
      <Text dimColor>{title}</Text>
    </Box>
  );
}
