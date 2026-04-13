import { describe, it, expect, vi, beforeEach } from 'vitest';
import os from 'os';
import path from 'path';
import { runSpec } from '../src/engine.js';
import * as startModule from '../src/start.js';
import * as stackModule from '../src/stack.js';
import type { Spec } from '../src/types.js';
import { TypedEmitter } from '../src/events.js';
import type { SisyphusEvents } from '../src/events.js';

vi.mock('../src/start.js', () => ({ start: vi.fn() }));
vi.mock('../src/stack.js', () => ({
  stack: vi.fn().mockResolvedValue([
    { type: 'analysis', source: 'test.json', data: '{"items": ["a", "b", "c"]}' },
  ]),
}));

const mockStart = vi.mocked(startModule.start);

function tmpOutput(): string {
  return path.join(os.tmpdir(), `sisyphus-engine-test-${Date.now()}-${Math.random().toString(36).slice(2)}.md`);
}

const baseSpec: Omit<Spec, 'boulders' | 'output'> = {
  title: 'Engine Test Run',
  layer: 'documentation',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('engine: runSpec', () => {
  it('passes clean on first attempt when structural checks pass', async () => {
    const validContent = '# Results\n\n| Name | Status |\n|------|--------|\n| a | done |\n| b | done |\n| c | done |';
    mockStart.mockResolvedValue(validContent);

    const spec: Spec = {
      ...baseSpec,
      output: tmpOutput(),
      boulders: [
        {
          name: 'Results Table',
          description: 'Produce a results table',
          criteria: [
            { check: 'contains-table', description: 'Must have a table with Name and Status columns', columns: ['Name', 'Status'] },
            { check: 'row-count-gte', description: 'Must have at least 3 data rows', min: 3 },
          ],
        },
      ],
    };

    const report = await runSpec(spec);

    expect(report.passedClean).toBe(1);
    expect(report.passedAfterClimb).toBe(0);
    expect(report.flagged).toBe(0);
    expect(report.totalBoulders).toBe(1);
    expect(report.boulders[0].status).toBe('passed');
    expect(report.boulders[0].attempts).toBe(1);
    // producer called exactly once — no retry needed
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('retries (climbs) when structural checks fail on first attempt', async () => {
    const tooFewRows = '| Name |\n|------|\n| a |';
    const enoughRows  = '| Name |\n|------|\n| a |\n| b |\n| c |';

    mockStart
      .mockResolvedValueOnce(tooFewRows)
      .mockResolvedValueOnce(enoughRows);

    const spec: Spec = {
      ...baseSpec,
      output: tmpOutput(),
      boulders: [
        {
          name: 'Retried Boulder',
          description: 'Must eventually produce 3 rows',
          criteria: [
            { check: 'row-count-gte', description: 'At least 3 data rows', min: 3 },
          ],
        },
      ],
    };

    const report = await runSpec(spec);

    expect(report.passedAfterClimb).toBe(1);
    expect(report.passedClean).toBe(0);
    expect(report.flagged).toBe(0);
    expect(report.boulders[0].status).toBe('passed');
    expect(report.boulders[0].attempts).toBe(2);
    expect(mockStart).toHaveBeenCalledTimes(2);

    // Second call must include climb feedback so producer knows what failed
    const secondCall = mockStart.mock.calls[1][0];
    expect(secondCall.prompt).toContain('Previous Attempt Failed');
    expect(secondCall.prompt).toContain('FAIL:');
  });

  it('flags a boulder after exhausting max retries', async () => {
    mockStart.mockResolvedValue('No table here at all.');

    const spec: Spec = {
      ...baseSpec,
      output: tmpOutput(),
      maxRetries: 2,
      boulders: [
        {
          name: 'Always Fails',
          description: 'Produce a table (will never succeed)',
          criteria: [
            { check: 'contains-table', description: 'Must have a table' },
          ],
        },
      ],
    };

    const report = await runSpec(spec);

    expect(report.flagged).toBe(1);
    expect(report.passedClean).toBe(0);
    expect(report.passedAfterClimb).toBe(0);
    expect(report.boulders[0].status).toBe('flagged');
    expect(report.boulders[0].failures).toBeDefined();
    expect(report.boulders[0].failures!.length).toBeGreaterThan(0);
    // 1 initial attempt + 2 retries = 3 total calls
    expect(mockStart).toHaveBeenCalledTimes(3);
  });

  it('spawns Hades for custom criteria and passes when evaluator approves', async () => {
    const producerOutput = '# Report\n\nAll items are valid.';
    const hadesResponse = JSON.stringify([
      { criterion: 'Content is accurate', pass: true, evidence: 'All items are valid', reason: 'Matches source' },
    ]);

    mockStart
      .mockResolvedValueOnce(producerOutput)   // Sisyphus (producer)
      .mockResolvedValueOnce(hadesResponse);   // Hades (evaluator)

    const spec: Spec = {
      ...baseSpec,
      output: tmpOutput(),
      boulders: [
        {
          name: 'Custom Criteria Boulder',
          description: 'Produce a report',
          criteria: [
            { check: 'custom', description: 'Content is accurate' },
          ],
        },
      ],
    };

    const report = await runSpec(spec);

    expect(report.passedClean).toBe(1);
    expect(report.flagged).toBe(0);
    expect(report.boulders[0].status).toBe('passed');
    expect(report.boulders[0].attempts).toBe(1);
    // producer + Hades = 2 calls
    expect(mockStart).toHaveBeenCalledTimes(2);
  });

  it('flags when Hades returns unparseable JSON', async () => {
    mockStart
      .mockResolvedValueOnce('Some content.')  // producer
      .mockResolvedValueOnce('NOT JSON AT ALL'); // broken Hades

    const spec: Spec = {
      ...baseSpec,
      output: tmpOutput(),
      maxRetries: 0,
      boulders: [
        {
          name: 'Bad Hades',
          description: 'Test broken evaluator handling',
          criteria: [
            { check: 'custom', description: 'Something should pass' },
          ],
        },
      ],
    };

    const report = await runSpec(spec);

    expect(report.flagged).toBe(1);
    const failure = report.boulders[0].failures?.find(f => f.criterion === 'Hades evaluation');
    expect(failure).toBeDefined();
    expect(failure?.pass).toBe(false);
    expect(failure?.message).toContain('Failed to parse Hades response');
  });

  it('processes multiple boulders independently', async () => {
    const goodTable = '| Col |\n|-----|\n| x |\n| y |\n| z |';
    // boulder 1 passes first try, boulder 2 fails first try then passes
    mockStart
      .mockResolvedValueOnce(goodTable)       // boulder 1, attempt 1 — pass
      .mockResolvedValueOnce('no table')      // boulder 2, attempt 1 — fail
      .mockResolvedValueOnce(goodTable);      // boulder 2, attempt 2 — pass

    const spec: Spec = {
      ...baseSpec,
      output: tmpOutput(),
      boulders: [
        {
          name: 'Boulder One',
          description: 'First boulder',
          criteria: [{ check: 'row-count-gte', description: 'At least 3 rows', min: 3 }],
        },
        {
          name: 'Boulder Two',
          description: 'Second boulder',
          criteria: [{ check: 'row-count-gte', description: 'At least 3 rows', min: 3 }],
        },
      ],
    };

    const report = await runSpec(spec);

    expect(report.totalBoulders).toBe(2);
    expect(report.passedClean).toBe(1);
    expect(report.passedAfterClimb).toBe(1);
    expect(report.flagged).toBe(0);
    expect(mockStart).toHaveBeenCalledTimes(3);
  });

  it('includes startedAt and completedAt timestamps in report', async () => {
    mockStart.mockResolvedValue('| A |\n|---|\n| 1 |');

    const spec: Spec = {
      ...baseSpec,
      output: tmpOutput(),
      boulders: [
        {
          name: 'Timestamp Boulder',
          description: 'Check timestamps',
          criteria: [{ check: 'contains-table', description: 'Must have a table' }],
        },
      ],
    };

    const before = new Date().toISOString();
    const report = await runSpec(spec);
    const after = new Date().toISOString();

    expect(report.startedAt).toBeTruthy();
    expect(report.completedAt).toBeTruthy();
    expect(report.startedAt >= before).toBe(true);
    expect(report.completedAt <= after).toBe(true);
    expect(report.startedAt <= report.completedAt).toBe(true);
  });

  it('throws when layer validation fails', async () => {
    const spec: Spec = {
      ...baseSpec,
      output: tmpOutput(),
      boulders: [
        // A boulder with no criteria will fail DocumentationLayer.validateSpec
        { name: 'Empty', description: 'No criteria', criteria: [] } as any,
      ],
    };

    await expect(runSpec(spec)).rejects.toThrow('Layer validation failed');
  });
});

describe('engine event emission', () => {
  it('emits run:start and run:end events', async () => {
    const emitter = new TypedEmitter<SisyphusEvents>();
    const events: string[] = [];
    emitter.on('run:start', () => events.push('run:start'));
    emitter.on('run:end', () => events.push('run:end'));

    mockStart.mockResolvedValue('# Heading\n\n| Col A | Col B |\n|---|---|\n| a | b |');
    const output = tmpOutput();
    await runSpec(
      { ...baseSpec, output, boulders: [{ name: 'test-boulder', description: 'Test',
        criteria: [{ check: 'contains-heading', description: 'Has heading', heading: 'Heading', level: 1 }] }] },
      { baseDir: import.meta.dirname, emitter },
    );
    expect(events).toEqual(['run:start', 'run:end']);
  });

  it('emits boulder lifecycle events in order', async () => {
    const emitter = new TypedEmitter<SisyphusEvents>();
    const events: string[] = [];
    emitter.on('boulder:start', () => events.push('boulder:start'));
    emitter.on('stack:start', () => events.push('stack:start'));
    emitter.on('stack:end', () => events.push('stack:end'));
    emitter.on('produce:start', () => events.push('produce:start'));
    emitter.on('produce:end', () => events.push('produce:end'));
    emitter.on('evaluate:start', () => events.push('evaluate:start'));
    emitter.on('evaluate:structural', () => events.push('evaluate:structural'));
    emitter.on('evaluate:end', () => events.push('evaluate:end'));
    emitter.on('boulder:end', () => events.push('boulder:end'));

    mockStart.mockResolvedValue('# Heading\n\nSome content here.');
    const output = tmpOutput();
    await runSpec(
      { ...baseSpec, output, boulders: [{ name: 'lifecycle-test', description: 'Test',
        criteria: [{ check: 'contains-heading', description: 'Has heading', heading: 'Heading', level: 1 }] }] },
      { baseDir: import.meta.dirname, emitter },
    );
    expect(events).toEqual([
      'boulder:start', 'stack:start', 'stack:end',
      'produce:start', 'produce:end',
      'evaluate:start', 'evaluate:structural', 'evaluate:end',
      'boulder:end',
    ]);
  });

  it('emits climb event on retry', async () => {
    const emitter = new TypedEmitter<SisyphusEvents>();
    const climbPayloads: any[] = [];
    emitter.on('climb', (p) => climbPayloads.push(p));

    mockStart
      .mockResolvedValueOnce('No heading here')
      .mockResolvedValueOnce('# Heading\n\nContent');
    const output = tmpOutput();
    await runSpec(
      { ...baseSpec, output, boulders: [{ name: 'climb-test', description: 'Test',
        criteria: [{ check: 'contains-heading', description: 'Has heading', heading: 'Heading', level: 1 }] }] },
      { baseDir: import.meta.dirname, emitter },
    );
    expect(climbPayloads).toHaveLength(1);
    expect(climbPayloads[0].boulderName).toBe('climb-test');
    expect(climbPayloads[0].attempt).toBe(0);
    expect(climbPayloads[0].failures.length).toBeGreaterThan(0);
  });

  it('works without emitter (backwards compatible)', async () => {
    mockStart.mockResolvedValue('# Heading\n\nContent');
    const output = tmpOutput();
    const report = await runSpec(
      { ...baseSpec, output, boulders: [{ name: 'no-emitter', description: 'Test',
        criteria: [{ check: 'contains-heading', description: 'Has heading', heading: 'Heading', level: 1 }] }] },
      { baseDir: import.meta.dirname },
    );
    expect(report.passedClean).toBe(1);
  });
});
