import React from 'react';
import { Text } from 'ink';

interface ProgressBarProps {
  completed: number;
  total: number;
  width?: number;
}

export const ProgressBar = React.memo(function ProgressBar({ completed, total, width = 20 }: ProgressBarProps) {
  const ratio = total > 0 ? completed / total : 0;
  const filledLen = Math.round(ratio * width);
  const emptyLen = width - filledLen;
  return (
    <Text>
      <Text color="cyan">{'━'.repeat(filledLen)}</Text>
      <Text dimColor>{'━'.repeat(emptyLen)}</Text>
    </Text>
  );
});
