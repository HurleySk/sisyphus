import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { AgentPanelState } from '../../state.js';
import { elapsedSeconds } from '../../hooks/useElapsed.js';
import { formatElapsed, sliceViewport } from '../../format.js';

export function SisyphusBody({ panel, viewportHeight }: { panel: AgentPanelState; viewportHeight: number }) {
  // Parent App ticks once/sec via useTick(), which re-renders this component
  const statusElapsed = panel.producerStatusStartedAt !== null ? elapsedSeconds(panel.producerStatusStartedAt) : 0;
  const elapsedLabel = panel.producerStatusStartedAt !== null ? ` ${formatElapsed(statusElapsed)}` : '';

  if (panel.producerStatus === 'idle' || panel.producerStatus === 'thinking') {
    const label = panel.producerStatus === 'idle' ? 'starting' : 'reasoning';
    return (
      <Box flexDirection="column">
        <Text>  <Spinner type="dots" /> {label}...{elapsedLabel}</Text>
        {panel.boulderDescription && (
          <>
            <Text />
            <Text dimColor>  {panel.boulderDescription}</Text>
          </>
        )}
        {panel.criteriaDescriptions.length > 0 && (
          <>
            <Text />
            <Text dimColor>  criteria:</Text>
            {panel.criteriaDescriptions.map((desc, i) => (
              <Text key={i} dimColor>    ○ {desc}</Text>
            ))}
          </>
        )}
        {panel.climbFeedback && (
          <>
            <Text />
            <Text color="yellow">  feedback from last attempt:</Text>
            <Text color="yellow">    {panel.climbFeedback}</Text>
          </>
        )}
      </Box>
    );
  }

  // Streaming — show lines with viewport windowing
  const { visible: visibleLines, overflowCount } = sliceViewport(panel.streamingLines, viewportHeight, 2);

  return (
    <Box flexDirection="column">
      {overflowCount > 0 && <Text dimColor>  ↑ {overflowCount} more lines</Text>}
      {visibleLines.map((line, i) => (
        <Text key={i}>  {line}</Text>
      ))}
      <Text>
        {'  '}<Spinner type="dots" /> writing...{elapsedLabel}
      </Text>
    </Box>
  );
}
