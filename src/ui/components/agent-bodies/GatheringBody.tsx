import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { AgentPanelState } from '../../state.js';
import { sliceViewport } from '../../format.js';

export function GatheringBody({ panel, viewportHeight }: { panel: AgentPanelState; viewportHeight: number }) {
  const totalLines = panel.stackFiles.reduce((sum, f) => sum + f.lines, 0);
  const { visible: visibleFiles, overflowCount } = sliceViewport(panel.stackFiles, viewportHeight, 2);

  return (
    <Box flexDirection="column">
      {overflowCount > 0 && <Text dimColor>  ↑ {overflowCount} more files</Text>}
      {visibleFiles.map((f, i) => (
        <Text key={i}>
          {'  '}<Text color="green">✓</Text> {f.path}
          <Text dimColor>{' '.repeat(Math.max(1, 40 - f.path.length))}{f.lines} lines</Text>
          {f.summarized && <Text color="yellow"> · summarized</Text>}
        </Text>
      ))}
      <Text>  <Spinner type="dots" /> gathering sources...</Text>
      {panel.stackFiles.length > 0 && (
        <Text dimColor>  {panel.stackFiles.length} files · {totalLines} lines total</Text>
      )}
    </Box>
  );
}
