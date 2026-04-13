import React from 'react';
import { Text } from 'ink';

interface BoulderPendingProps { name: string; }

export function BoulderPending({ name }: BoulderPendingProps) {
  return <Text dimColor>  ◦ {name}</Text>;
}
