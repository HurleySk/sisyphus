import React from 'react';
import { Box, Text } from 'ink';
import type { CompletedBoulder } from '../state.js';
import { ProgressBar } from './ProgressBar.js';
import { formatElapsed, formatDuration } from '../format.js';

interface StatusBarProps {
  completed: CompletedBoulder[];
  activeBoulderName: string | null;
  pendingNames: string[];
  total: number;
  elapsed: number;
}

function BoulderBadge({ name, icon, color, time }: { name: string; icon: string; color: string; time?: string }) {
  return (
    <Text>
      <Text color={color}>{icon}</Text> {name}{time ? ` ${time}` : ''}{'    '}
    </Text>
  );
}

export function StatusBar({ completed, activeBoulderName, pendingNames, total, elapsed }: StatusBarProps) {
  const completedCount = completed.length;

  return (
    <Box flexDirection="column">
      <Text dimColor>{'─'.repeat(54)}</Text>
      <Box>
        {completed.map((b) => {
          const icon = b.status === 'flagged' ? '✗' : '✓';
          const color = b.status === 'flagged' ? 'red' : b.attempts > 1 ? 'yellow' : 'green';
          return <BoulderBadge key={b.name} name={b.name} icon={icon} color={color} time={formatDuration(b.durationMs)} />;
        })}
        {activeBoulderName && (
          <BoulderBadge name={activeBoulderName} icon="●" color="cyan" time={formatElapsed(elapsed)} />
        )}
        {pendingNames.map((name) => (
          <BoulderBadge key={name} name={name} icon="○" color="gray" />
        ))}
      </Box>
      <Box>
        <ProgressBar completed={completedCount} total={total} width={30} />
        <Text>  {completedCount}/{total} · {formatElapsed(elapsed)}</Text>
      </Box>
    </Box>
  );
}
