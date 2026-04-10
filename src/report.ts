import fs from 'fs/promises';
import path from 'path';
import type { BoulderOutput, RunReport } from './types.js';

export function buildReport(title: string, outputs: BoulderOutput[]): RunReport {
  return {
    title,
    startedAt: '',
    completedAt: new Date().toISOString(),
    boulders: outputs,
    totalBoulders: outputs.length,
    passedClean: outputs.filter(o => o.status === 'passed' && o.attempts === 1).length,
    passedAfterClimb: outputs.filter(o => o.status === 'passed' && o.attempts > 1).length,
    flagged: outputs.filter(o => o.status === 'flagged').length,
  };
}

export async function writeReport(report: RunReport, outputPath: string): Promise<void> {
  const dir = path.dirname(outputPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');
}
