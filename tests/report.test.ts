import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type { BoulderOutput } from '../src/types.js';
import { buildReport, writeReport } from '../src/report.js';

const makeBoulder = (name: string, status: 'passed' | 'flagged', attempts: number): BoulderOutput => ({
  name,
  content: `Content for ${name}`,
  attempts,
  status,
});

describe('buildReport', () => {
  it('summarizes boulder outcomes correctly (1 clean, 1 after climb, 1 flagged)', () => {
    const outputs: BoulderOutput[] = [
      makeBoulder('intro', 'passed', 1),       // passedClean
      makeBoulder('summary', 'passed', 2),      // passedAfterClimb
      makeBoulder('appendix', 'flagged', 3),    // flagged
    ];

    const report = buildReport('Test Run', outputs);

    expect(report.title).toBe('Test Run');
    expect(report.totalBoulders).toBe(3);
    expect(report.passedClean).toBe(1);
    expect(report.passedAfterClimb).toBe(1);
    expect(report.flagged).toBe(1);
    expect(report.boulders).toEqual(outputs);
    expect(report.completedAt).toBeTruthy();
    // startedAt is set to empty string by default (caller fills it in)
    expect(report.startedAt).toBe('');
  });

  it('returns zeroes when all boulders pass clean', () => {
    const outputs: BoulderOutput[] = [
      makeBoulder('a', 'passed', 1),
      makeBoulder('b', 'passed', 1),
    ];

    const report = buildReport('All Clean', outputs);

    expect(report.passedClean).toBe(2);
    expect(report.passedAfterClimb).toBe(0);
    expect(report.flagged).toBe(0);
    expect(report.totalBoulders).toBe(2);
  });

  it('handles empty outputs', () => {
    const report = buildReport('Empty', []);

    expect(report.totalBoulders).toBe(0);
    expect(report.passedClean).toBe(0);
    expect(report.passedAfterClimb).toBe(0);
    expect(report.flagged).toBe(0);
    expect(report.boulders).toEqual([]);
  });
});

describe('writeReport', () => {
  let tmpDir: string | undefined;

  afterEach(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
      tmpDir = undefined;
    }
  });

  it('writes JSON report to disk and the content matches', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sisyphus-report-test-'));
    const outputPath = path.join(tmpDir, 'subdir', 'run-report.json');

    const outputs: BoulderOutput[] = [
      makeBoulder('section-1', 'passed', 1),
      makeBoulder('section-2', 'flagged', 2),
    ];
    const report = buildReport('Write Test', outputs);

    await writeReport(report, outputPath);

    const raw = await fs.readFile(outputPath, 'utf-8');
    const parsed = JSON.parse(raw);

    expect(parsed.title).toBe('Write Test');
    expect(parsed.totalBoulders).toBe(2);
    expect(parsed.passedClean).toBe(1);
    expect(parsed.flagged).toBe(1);
    expect(parsed.boulders).toHaveLength(2);
  });

  it('creates intermediate directories if they do not exist', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sisyphus-report-mkdir-'));
    const deepPath = path.join(tmpDir, 'a', 'b', 'c', 'report.json');

    const report = buildReport('Deep Dir Test', []);
    await writeReport(report, deepPath);

    const exists = await fs.access(deepPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });
});
