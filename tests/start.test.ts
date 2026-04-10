import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

// Import after mock is set up
import { spawn } from 'child_process';
import { start } from '../src/start.js';

const mockSpawn = vi.mocked(spawn);

/** Creates a minimal mock child_process object with stdin/stdout/stderr streams */
function makeProc() {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.stdin = { write: vi.fn(), end: vi.fn() };
  return proc;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('start', () => {
  it('spawns claude with --print and returns stdout', async () => {
    const proc = makeProc();
    mockSpawn.mockReturnValue(proc);

    const promise = start({ prompt: 'Write something' });

    proc.stdout.emit('data', Buffer.from('Hello from claude'));
    proc.emit('close', 0);

    const result = await promise;

    expect(mockSpawn).toHaveBeenCalledWith(
      'claude',
      expect.arrayContaining(['--print']),
      expect.objectContaining({ timeout: 120_000, stdio: ['pipe', 'pipe', 'pipe'] }),
    );
    expect(result).toBe('Hello from claude');
  });

  it('writes prompt to stdin instead of passing as CLI arg', async () => {
    const proc = makeProc();
    mockSpawn.mockReturnValue(proc);

    const promise = start({ prompt: 'Write something' });
    proc.emit('close', 0);
    await promise;

    // Prompt must NOT appear in the spawned args
    const args = mockSpawn.mock.calls[0][1] as string[];
    expect(args).not.toContain('Write something');
    expect(args).not.toContain('-p');

    // Prompt must be piped via stdin
    expect(proc.stdin.write).toHaveBeenCalledWith('Write something');
    expect(proc.stdin.end).toHaveBeenCalled();
  });

  it('includes model flag when specified', async () => {
    const proc = makeProc();
    mockSpawn.mockReturnValue(proc);

    const promise = start({ prompt: 'Write something', model: 'haiku' });
    proc.emit('close', 0);
    await promise;

    const args = mockSpawn.mock.calls[0][1] as string[];
    expect(args).toContain('--model');
    expect(args).toContain('haiku');
  });

  it('includes output format flag when specified', async () => {
    const proc = makeProc();
    mockSpawn.mockReturnValue(proc);

    const promise = start({ prompt: 'Write something', outputFormat: 'json' });
    proc.stdout.emit('data', Buffer.from('{}'));
    proc.emit('close', 0);
    await promise;

    const args = mockSpawn.mock.calls[0][1] as string[];
    expect(args).toContain('--output-format');
    expect(args).toContain('json');
  });

  it('throws on non-zero exit code', async () => {
    const proc = makeProc();
    mockSpawn.mockReturnValue(proc);

    const promise = start({ prompt: 'Write something' });
    proc.stderr.emit('data', Buffer.from('something went wrong'));
    proc.emit('close', 1);

    await expect(promise).rejects.toThrow('claude exited with code 1');
  });

  it('throws on spawn error', async () => {
    const proc = makeProc();
    mockSpawn.mockReturnValue(proc);

    const promise = start({ prompt: 'Write something' });
    proc.emit('error', new Error('spawn ENOENT'));

    await expect(promise).rejects.toThrow('spawn ENOENT');
  });
});
