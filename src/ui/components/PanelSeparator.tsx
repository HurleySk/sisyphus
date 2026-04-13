import React from 'react';
import { Box, Text } from 'ink';

export function PanelSeparator() {
  return (
    <Box marginY={0}>
      <Text dimColor>{'─'.repeat(50)}</Text>
    </Box>
  );
}
