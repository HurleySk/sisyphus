import type { RunReport } from '../../types.js';

function pad(str: string, len: number): string {
  return str + ' '.repeat(Math.max(0, len - str.length));
}

export function formatSummary(report: RunReport, artifactPath: string, reportPath: string): string {
  const lines: string[] = [];
  const nameWidth = Math.max(7, ...report.boulders.map(b => b.name.length));
  const statusWidth = 7;
  const attemptsWidth = 8;

  lines.push(`┌${'─'.repeat(nameWidth + 2)}┬${'─'.repeat(statusWidth + 2)}┬${'─'.repeat(attemptsWidth + 2)}┐`);
  lines.push(`│ ${pad('Boulder', nameWidth)} │ ${pad('Status', statusWidth)} │ ${pad('Attempts', attemptsWidth)} │`);
  lines.push(`├${'─'.repeat(nameWidth + 2)}┼${'─'.repeat(statusWidth + 2)}┼${'─'.repeat(attemptsWidth + 2)}┤`);

  for (const b of report.boulders) {
    const statusIcon = b.status === 'flagged' ? '✗ flag' : b.attempts > 1 ? '✓ climb' : '✓ pass';
    lines.push(`│ ${pad(b.name, nameWidth)} │ ${pad(statusIcon, statusWidth)} │ ${pad(String(b.attempts), attemptsWidth)} │`);
  }

  lines.push(`└${'─'.repeat(nameWidth + 2)}┴${'─'.repeat(statusWidth + 2)}┴${'─'.repeat(attemptsWidth + 2)}┘`);

  const parts: string[] = [];
  const totalPassed = report.passedClean + report.passedAfterClimb;
  if (totalPassed > 0) parts.push(`${totalPassed} passed`);
  if (report.flagged > 0) parts.push(`${report.flagged} flagged`);
  lines.push(parts.join(' · '));
  lines.push(`Artifact: ${artifactPath}`);
  lines.push(`Report:   ${reportPath}`);

  return lines.join('\n');
}

export function printSummary(report: RunReport, artifactPath: string, reportPath: string): void {
  console.log('\n' + formatSummary(report, artifactPath, reportPath));
}
