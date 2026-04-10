import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

vi.mock('../src/start.js', () => ({
  start: vi.fn(),
}));

import { start } from '../src/start.js';
import { stack } from '../src/stack.js';

const mockStart = vi.mocked(start);

// Absolute path to the fixtures directory
const fixturesDir = path.join(import.meta.dirname, 'fixtures');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('stack', () => {
  it('returns empty array when sources is undefined', async () => {
    const result = await stack(undefined, fixturesDir);
    expect(result).toEqual([]);
  });

  it('returns empty array when sources is empty', async () => {
    const result = await stack([], fixturesDir);
    expect(result).toEqual([]);
  });

  it('reads a small file directly without spawning gather agent', async () => {
    const sources = [
      {
        type: 'analysis',
        source: 'fixtures/sample-source.txt',
        instruction: 'Summarise this file',
      },
    ];

    // baseDir is parent of fixtures so we can resolve 'fixtures/sample-source.txt'
    const baseDir = path.join(fixturesDir, '..');

    const result = await stack(sources, baseDir);

    expect(mockStart).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('analysis');
    expect(result[0].source).toContain('sample-source.txt');
    expect(result[0].data).toContain('Line 1: Project overview');
  });

  it('resolves glob patterns and returns a result per matched file', async () => {
    const sources = [
      {
        type: 'analysis',
        source: 'fixtures/*.json',
        instruction: 'Extract key fields',
      },
    ];

    const baseDir = path.join(fixturesDir, '..');

    const result = await stack(sources, baseDir);

    expect(mockStart).not.toHaveBeenCalled();
    // fixtures/ contains valid-spec.json and invalid-spec-no-layer.json
    expect(result.length).toBeGreaterThanOrEqual(2);
    for (const r of result) {
      expect(r.type).toBe('analysis');
      expect(r.source).toMatch(/\.json$/);
      expect(r.data).toBeTruthy();
    }
  });

  it('spawns a gather agent for large files (> 200 lines)', async () => {
    mockStart.mockResolvedValue('Summarised large file content');

    // Create a temp file with more than 200 lines
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sisyphus-test-'));
    const largePath = path.join(tmpDir, 'large.txt');
    const lines = Array.from({ length: 201 }, (_, i) => `Line ${i + 1}: data`).join('\n');
    await fs.writeFile(largePath, lines, 'utf8');

    try {
      const sources = [
        {
          type: 'analysis',
          source: largePath,
          instruction: 'Extract key data',
        },
      ];

      const result = await stack(sources, tmpDir);

      expect(mockStart).toHaveBeenCalledOnce();
      const callArg = mockStart.mock.calls[0][0];
      expect(callArg.model).toBe('haiku');
      expect(callArg.prompt).toContain('Extract key data');

      expect(result).toHaveLength(1);
      expect(result[0].data).toBe('Summarised large file content');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('warns and returns a not-supported result for unsupported stack types', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const sources = [
      { type: 'ado-search', query: 'something' },
      { type: 'task', id: '123' },
    ];

    const result = await stack(sources, fixturesDir);

    expect(mockStart).not.toHaveBeenCalled();
    expect(result).toHaveLength(2);
    for (const r of result) {
      expect(r.data).toMatch(/not supported/i);
    }
    expect(warnSpy).toHaveBeenCalledTimes(2);

    warnSpy.mockRestore();
  });
});
