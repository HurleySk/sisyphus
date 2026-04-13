import React from 'react';
import { Box, Text } from 'ink';
import type { StackFileEntry } from '../state.js';

interface PhaseStackProps { files: StackFileEntry[]; }

export function PhaseStack({ files }: PhaseStackProps) {
  return (
    <Box flexDirection="column" marginLeft={2}>
      <Text dimColor>STACK</Text>
      {files.map((f, i) => (
        <Text key={i}>
          <Text color="green">  ✓</Text> <Text dimColor>{f.path}</Text>{' '}
          <Text dimColor>({f.lines} lines{f.summarized ? ' · summarized' : ''})</Text>
        </Text>
      ))}
      {files.length === 0 && <Text dimColor>  gathering sources...</Text>}
    </Box>
  );
}
