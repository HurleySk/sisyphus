import React from 'react';
import { Box, Text } from 'ink';
import type { CompletedBoulder } from '../state.js';
import { ProgressBar } from './ProgressBar.js';
import { formatElapsed, formatDuration, boulderStatusStyle } from '../format.js';

interface StatusBarProps {
  completed: CompletedBoulder[];
  activeBoulderName: string | null;
  boulderElapsed: number;
  pendingNames: string[];
  total: number;
  elapsed: number;
  columns?: number;
  activePhase: string | null;
}

function BoulderBadge({ name, icon, color, time }: { name: string; icon: string; color: string; time?: string }) {
  return (
    <Text>
      <Text color={color}>{icon}</Text> {name}{time ? ` ${time}` : ''}{'    '}
    </Text>
  );
}

// --- Badge width estimation helpers ---

function completedBadgeWidth(b: CompletedBoulder): number {
  // icon(1) + space(1) + name + space(1) + time(~len) + padding(4)
  const time = formatDuration(b.durationMs);
  return 1 + 1 + b.name.length + 1 + time.length + 4;
}

function activeBadgeWidth(name: string, phase: string | null, elapsed: number): number {
  // icon(1) + space(1) + name + [" · phase"] + space(1) + time + padding(4)
  const phasePart = phase ? ` · ${phase}` : '';
  const time = formatElapsed(elapsed);
  return 1 + 1 + name.length + phasePart.length + 1 + time.length + 4;
}

function pendingBadgeWidth(name: string): number {
  // icon(1) + space(1) + name + padding(4)
  return 1 + 1 + name.length + 4;
}

// --- Layout types and computation ---

export interface BadgeLayout {
  completedBadges: CompletedBoulder[];
  collapsedCompleted: number | null;   // null = show all individually, number = show "N✓" summary
  showActive: boolean;
  pendingBadges: string[];
  collapsedPending: number | null;     // null = show all individually, number = show "+N pending"
}

/** Width of the "+N pending" collapsed label including padding */
function collapsedPendingWidth(count: number): number {
  // "+N pending    " = 1 + digits + 1 + 7 + 4
  return `+${count} pending`.length + 4;
}

/** Width of the "N✓" collapsed completed label including padding */
function collapsedCompletedWidth(count: number): number {
  // "N✓    " = digits + 1 + 4
  return `${count}✓`.length + 4;
}

export function computeLayout(
  completed: CompletedBoulder[],
  activeBoulderName: string | null,
  activePhase: string | null,
  boulderElapsed: number,
  pendingNames: string[],
  availableWidth: number,
): BadgeLayout {
  const activeWidth = activeBoulderName
    ? activeBadgeWidth(activeBoulderName, activePhase, boulderElapsed)
    : 0;

  const completedWidths = completed.map(b => completedBadgeWidth(b));
  const totalCompletedWidth = completedWidths.reduce((s, w) => s + w, 0);

  const pendingWidths = pendingNames.map(n => pendingBadgeWidth(n));
  const totalPendingWidth = pendingWidths.reduce((s, w) => s + w, 0);

  const totalWidth = totalCompletedWidth + activeWidth + totalPendingWidth;

  // Level 0: everything fits
  if (totalWidth <= availableWidth) {
    return {
      completedBadges: completed,
      collapsedCompleted: null,
      showActive: !!activeBoulderName,
      pendingBadges: pendingNames,
      collapsedPending: null,
    };
  }

  // Level 1: collapse pending to "+N pending"
  const level1PendingWidth = pendingNames.length > 0 ? collapsedPendingWidth(pendingNames.length) : 0;
  const level1Width = totalCompletedWidth + activeWidth + level1PendingWidth;

  if (level1Width <= availableWidth) {
    return {
      completedBadges: completed,
      collapsedCompleted: null,
      showActive: !!activeBoulderName,
      pendingBadges: [],
      collapsedPending: pendingNames.length > 0 ? pendingNames.length : null,
    };
  }

  // Level 2: collapse completed to "N✓" + active + "+N pending"
  return {
    completedBadges: [],
    collapsedCompleted: completed.length > 0 ? completed.length : null,
    showActive: !!activeBoulderName,
    pendingBadges: [],
    collapsedPending: pendingNames.length > 0 ? pendingNames.length : null,
  };
}

export function StatusBar({ completed, activeBoulderName, boulderElapsed, pendingNames, total, elapsed, columns, activePhase }: StatusBarProps) {
  const separatorWidth = columns ?? 54;

  const layout = computeLayout(completed, activeBoulderName, activePhase, boulderElapsed, pendingNames, separatorWidth);

  return (
    <Box flexDirection="column">
      <Text dimColor>{'━'.repeat(separatorWidth)}</Text>
      <Box>
        {layout.collapsedCompleted !== null ? (
          <Text dimColor>{layout.collapsedCompleted}✓{'    '}</Text>
        ) : (
          layout.completedBadges.map((b) => {
            const style = boulderStatusStyle(b);
            return <BoulderBadge key={b.name} name={b.name} icon={style.icon} color={style.color} time={formatDuration(b.durationMs)} />;
          })
        )}
        {layout.showActive && activeBoulderName && (
          <Text>
            <Text color="cyan">●</Text> {activeBoulderName}{activePhase ? ` · ${activePhase}` : ''} {formatElapsed(boulderElapsed)}{'    '}
          </Text>
        )}
        {layout.collapsedPending !== null ? (
          <Text dimColor>+{layout.collapsedPending} pending</Text>
        ) : (
          layout.pendingBadges.map((name) => (
            <BoulderBadge key={name} name={name} icon="○" color="gray" />
          ))
        )}
      </Box>
      <Box>
        <ProgressBar completed={completed.length} total={total} width={30} />
        <Text>  {completed.length}/{total} · {formatElapsed(elapsed)}</Text>
      </Box>
    </Box>
  );
}
